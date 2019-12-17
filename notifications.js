require('dotenv').config()
const RingCentral = require('@ringcentral/sdk').SDK
var fs = require('fs')

const http = require('http');
var url = require('url');

http.createServer((request, response) => {
  console.log(`Request url: ${request.url}`);

  if (request.method === "POST"){
      if (request.url === "/webhookcallback") {
        if(request.headers.hasOwnProperty("validation-token")) {
            response.setHeader('Validation-Token', request.headers['validation-token']);
            response.statusCode = 200;
            response.end();
        }else{
          var body = []
          request.on('data', function(chunk) {
              body.push(chunk);
            }).on('end', function() {
              body = Buffer.concat(body).toString();
              var jsonObj = JSON.parse(body)
              for (var party of jsonObj.body.parties){
                console.log("Receive session notification")
                if (party.direction === "Inbound"){
                  if (party.status.code === "Proceeding"){
                    console.log("Ringing")
                  }else if (party.status.code === "Answered"){
                    console.log("Answered")
                    processTelephonySessionNotification(jsonObj.body)
                  }else if (party.status.code === "Disconnected"){
                    console.log("Hanged up")
                  }else
                    console.log(JSON.stringify(jsonObj.body))
                  return
                }else
                  console.log(JSON.stringify(jsonObj.body))
              }
            });
        }
      }
  }else{
      console.log("Not GET nor POST method?")
      response.writeHead(404);
      response.end();
  }
}).listen(5001, () => {
  console.log('Server running at http://127.0.0.1:5001/');
});

const rc = new RingCentral({
  server: process.env.RINGCENTRAL_SERVER_URL,
  clientId: process.env.RINGCENTRAL_CLIENT_ID,
  clientSecret: process.env.RINGCENTRAL_CLIENT_SECRET
})

rc.login({
        username: process.env.RINGCENTRAL_USERNAME,
        extension: process.env.RINGCENTRAL_EXTENSION,
        password: process.env.RINGCENTRAL_PASSWORD
  })
  .then(function(resp){
    fs.readFile('subscriptionId.txt', 'utf8', function (err, id) {
        if (err) {
          console.log("call startWebHookSubscription")
          startWebhookSubscription()
        }else{
          console.log("subscription id: " + id)
          checkRegisteredWebHookSubscription(id)
        }
    });
  })
  .catch(function(e) {
    console.error(e.toString());
  });

async function processTelephonySessionNotification(body){
  var deviceId = fs.readFileSync('deviceId.txt', 'utf8')
  try{
      var endpoint = `/restapi/v1.0/account/~/telephony/sessions/${body.telephonySessionId}/supervise`
      var params = {
            mode: 'Listen',
            supervisorDeviceId: deviceId,
            agentExtensionNumber: process.env.RINGCENTRAL_AGENT_EXT
          }
      var res = await rc.post(endpoint, params)
  }catch(e) {
      console.log(e.message)
      console.log(e)
  }
}

async function startWebhookSubscription() {
    var r = await rc.get('/restapi/v1.0/account/~/extension')
    var json = await r.json()
    const agentExt = json.records.filter(ext => ext.extensionNumber === process.env.RINGCENTRAL_AGENT_EXT)[0]

    var paramsEvent = `/restapi/v1.0/account/~/extension/${agentExt.id}/telephony/sessions`
    var eventFilters = [
          paramsEvent
        ]
    var res = await  rc.post('/restapi/v1.0/subscription',
            {
                eventFilters: eventFilters,
                deliveryMode: {
                    transportType: 'WebHook',
                    address: process.env.DELIVERY_MODE_ADDRESS
                }
            })
    var jsonObj = await res.json()
    console.log("Ready to receive telephonyStatus notification via WebHook.")
    //console.log(JSON.stringify(jsonObj))
    try {
      fs.writeFile("subscriptionId.txt", jsonObj.id, function(err) {
          if(err)
              console.log(err);
          else
              console.log("SubscriptionId " + jsonObj.id + " is saved.");
      });
    }catch (e){
      console.log("WriteFile err")
    }
}

async function checkRegisteredWebHookSubscription(subscriptionId) {
    try {
      let response = await rc.get('/restapi/v1.0/subscription')
      let json = await response.json();
      if (json.records.length > 0){
        for(var record of json.records) {
          if (record.id == subscriptionId) {
            if (record.deliveryMode.transportType == "WebHook"){
              if (process.env.DELETE_EXISTING_WEBHOOK_SUBSCRIPTION == 1){
                // Needed for local test as ngrok address might be expired
                console.log("Subscription exist => delete it then subscribe a new one")
                await rc.delete('/restapi/v1.0/subscription/' + record.id)
                startWebhookSubscription()
              }else{
                if (record.status != "Active"){
                  console.log("Subscription is not active => renew it")
                  await rc.post('/restapi/v1.0/subscription/' + record.id + "/renew")
                  console.log("Renew: " + record.id)
                }else {
                  console.log("Subscription is active => good to go.")
                  console.log("sub status: " + record.status)
                }
              }
            }
          }
        }
      }else{
        console.log("No subscription for this service => create one.")
        startWebhookSubscription()
      }
    }catch(e){
      console.log("checkRegisteredWebHookSubscription ERROR")
      console.log(e)
    }
}

/// Clean up WebHook subscriptions
function deleteAllRegisteredWebHookSubscriptions(platform) {
    rc.get('/restapi/v1.0/subscription')
        .then(function (response) {
          var data = response.json();
          if (data.records.length > 0){
            for(var record of data.records) {
                if (record.deliveryMode.transportType == "WebHook"){
                    platform.delete('/subscription/' + record.id)
                      .then(function (response) {
                        console.log("Deleted: " + record.id)
                      })
                      .catch(function(e) {
                        console.error(e);
                      });
                }
            }
          }
        })
        .catch(function(e) {
          console.error(e);
        });
}
