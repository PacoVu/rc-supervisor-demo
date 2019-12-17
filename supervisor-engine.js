require('dotenv').config()
const RingCentral = require('@ringcentral/sdk').SDK

const fs = require('fs')
const { RTCAudioSink } = require('wrtc').nonstandard
const Softphone = require('ringcentral-softphone').default

const WatsonEngine = require('./watson.js');
var server = require('./index')


function PhoneEngine() {
  this.watson = new WatsonEngine()
  this.speachRegconitionReady = false
  this.doRecording = false
  this.audioStream = null
  this.softphone = null
  this.deviceId = ""
  this.rc = new RingCentral({
    server: process.env.RINGCENTRAL_SERVER_URL,
    clientId: process.env.RINGCENTRAL_CLIENT_ID,
    clientSecret: process.env.RINGCENTRAL_CLIENT_SECRET
  })
  return this
}

PhoneEngine.prototype = {
  initializePhoneEngine: async function(){
    console.log("initializePhoneEngine")
    if (this.softphone)
      return
    await this.rc.login({
      username: process.env.RINGCENTRAL_USERNAME,
      extension: process.env.RINGCENTRAL_EXTENSION,
      password: process.env.RINGCENTRAL_PASSWORD
    })

    this.softphone = new Softphone(this.rc)
    try {
        await this.softphone.register()
        this.deviceId = this.softphone.device.id
        console.log("Registered deviceId: " + this.deviceId)
        saveDeviceId(this.deviceId)
        server.sendPhoneEvent('online')
        let audioSink

        this.softphone.on('INVITE', sipMessage => {
          console.log("GOT INVITED")
          var maxFrames = 60
          this.softphone.answer(sipMessage)
          server.sendPhoneEvent('connected')
          this.softphone.once('track', e => {
            audioSink = new RTCAudioSink(e.track)
            var frames = 0
            var buffer = null
            var creatingWatsonSocket = false
            audioSink.ondata = data => {
              var buf = Buffer.from(data.samples.buffer)
              if (!creatingWatsonSocket && !this.speachRegconitionReady){
                creatingWatsonSocket = true
                this.watson.createWatsonSocket(data.sampleRate, (err, res) => {
                  if (!err) {
                    this.speachRegconitionReady = true
                    console.log("WatsonSocket created!")
                  }
                })
              }
              if (buffer != null)
                  buffer = Buffer.concat([buffer, buf])
              else
                  buffer = buf
              frames++
              if (frames >= maxFrames){
                  if (this.speachRegconitionReady){
                    console.log("call transcribe " + buffer.length)
                    this.watson.transcribe(buffer)
                  }else{
                    console.log("Dumping data")
                  }
                  buffer = Buffer.from('')
                  frames=0
              }
              if (this.doRecording)
                this.audioStream.write(Buffer.from(data.samples.buffer))
            }
          })
      })
      this.softphone.on('BYE', () => {
          console.log("RECEIVE BYE MESSAGE => Hanged up now")
          audioSink.stop()
          if (this.doRecording)
            this.audioStream.end()
          console.log("Close Watson socket.")
          this.watson.closeConnection()
          this.speachRegconitionReady = false
          server.sendPhoneEvent('idle')
        })
    }catch(e){
        console.log(e)
    }
  },
  enableRecording: function(recording){
    if (recording){
      const audioPath = 'audio.raw'
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath)
      }
      this.audioStream = fs.createWriteStream(audioPath, { flags: 'a' })
      this.doRecording = true
    }else{
      this.doRecording = false
      this.audioStream.close() // end
    }
  },
  handleCallRecording: function (recoringState){
    console.log("recoringState: " + recoringState)
  },
  enableTranslation: function(flag) {
    if (this.watson)
      this.watson.enableTranslation(flag)
  }
}
module.exports = PhoneEngine;

function saveDeviceId(deviceId){
  try {
    fs.writeFile("deviceId.txt", deviceId, function(err) {
        if(err)
            console.log(err);
        else
            console.log("deviceId " + deviceId + " is saved.");
    });
  }catch (e){
    console.log("WriteFile err")
  }
}
