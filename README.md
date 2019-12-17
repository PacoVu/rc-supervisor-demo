# RingCentral call supervise demo

## Setup

```
npm install
cp .env.sample .env
```

Edit `.env` to specify credentials.

 - `RINGCENTRAL_USERNAME` is the supervisor
 - `RINGCENTRAL_AGENT_EXT` is the extension number to be supervised, such as `116`


## Run

Ngrok tunnel
```
$ ngrok http 5001
```
Copy the ngrok address and specify it in the .env as follow:

`DELIVERY_MODE_ADDRESS=https://7ba3f616.ngrok.io/webhookcallback'

Client
```
$ npm start
```
Subscription
```
$ node notifications.js
```
SIP Registration
```
$ node index.js
```

## Test

Make a incoming call to `RINGCENTRAL_AGENT_EXT`, answer it, talk via the phone call.

Watch the console output, you should see something like `live audio data received, sample rate is 8000`.


## Check the saved audio

We got audio data in real time. We could have done something more meaningful with the data.
But for this demo we simply append the data to an audio file `audio.raw`.

You can play the saved audio by:

```
play -c 1 -r 16000 -e signed -b 16 audio.raw
```

The audio content should be same as the incoming call to `RINGCENTRAL_AGENT_EXT` we made.
