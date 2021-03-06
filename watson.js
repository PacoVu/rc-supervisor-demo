const WS = require('ws')
var request = require('request')
var fs = require('fs')
var server = require('./index')
const LanguageTranslatorV3 = require('watson-developer-cloud/language-translator/v3');
const NaturalLanguageUnderstandingV1 = require("ibm-watson/natural-language-understanding/v1.js")

var language_model = 'en-US_NarrowbandModel'

var ws = null
//
function WatsonEngine() {
  this.doTranslation = false

  this.wsURI = 'wss://stream.watsonplatform.net/speech-to-text/api/v1/recognize?watson-token=[TOKEN]&model=en-US_NarrowbandModel&x-watson-learning-opt-out=1';
  var getTokenForm = {
    method: 'GET',
    uri: 'https://'+process.env.WATSON_SPEECH_TO_TEXT_USERNAME+':'+ process.env.WATSON_SPEECH_TO_TEXT_PASSWORD+'@stream.watsonplatform.net/authorization/api/v1/token?url=https://stream.watsonplatform.net/speech-to-text/api',
  };
  this.naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
    version: '2019-07-12',
    iam_apikey: process.env.WATSON_NATURAL_LANGUAGE_UNDERSTANDING_API_KEY,
    url: 'https://gateway.watsonplatform.net/natural-language-understanding/api'
  });

  this.languageTranslator = new LanguageTranslatorV3({
    version: '2018-05-01',
    iam_apikey: process.env.WATSON_LANGUAGE_TRANSLATION_API_KEY,
    url: 'https://gateway.watsonplatform.net/language-translator/api'
  });

  this.sentimentScore = 0
  this.sentimentCount = 1

  this.emotionCount = 1
  this.sadnessScore = 0
  this.joyScore = 0
  this.fearScore = 0
  this.disgustScore = 0
  this.angerScore = 0

  this.keywords = []
  this.wordsArr = []
  this.speakersArr = []
  this.speakersText = {}

  this.transcript = {
    index: 0,
    speaker: "Identifying speaker",
    timestamp: "xx.xx",
    status: false,
    text: "",
    translation: "",
    analysis: {
      sentimentScore: 0,
      sadnessScore: 0,
      joyScore: 0,
      fearScore: 0,
      disgustScore: 0,
      angerScore: 0
    }
  }

  var thisClass = this
  request(getTokenForm, function(error, response, body) {
    thisClass.wsURI = thisClass.wsURI.replace('[TOKEN]', body);
    //console.log(thisClass.wsURI)
  });
  return this
}

WatsonEngine.prototype = {
  createWatsonSocket: function(sampleRate, callback){
    console.log("createWatsonSocket")
    ws = new WS(this.wsURI);
    var message = {
      'action': 'start',
      'content-type': 'audio/l16;rate='+ sampleRate +';channels=1',
      'timestamps': false,
      'interim_results': true,
      'inactivity_timeout': -1,
      'smart_formatting': true,
      'speaker_labels': true
    };
    var thisClass = this
    ws.on('open', function(evt) {
      console.log("Watson Socket open")
      ws.send(JSON.stringify(message));
      callback(null, "READY")
    });
    ws.on('close', function(data) {
      console.log("Watson Socket closed")
      console.log(data)
    });

    ws.on('connection', function(evt) {
      console.log("Watson Socket connect")
      console.log(evt);
    });
    ws.on('error', function(evt) {
      console.log("Watson Socket error")
      console.log(evt);
      callback(evt, "")
    });
    ws.on('message', function(evt) {
      var res = JSON.parse(evt)
      if (res.hasOwnProperty('results')){
        thisClass.transcript.index = res.result_index
        thisClass.transcript.speaker = "1"
        thisClass.transcript.timestamp = "xx.xx"
        thisClass.transcript.status = res.results[0].final
        thisClass.transcript.text = res.results[0].alternatives[0].transcript
        thisClass.transcript.translation = ""

        if (res.results[0].final){
          var text = res.results[0].alternatives[0].transcript
          text = text.trim()
          var wordCount = text.split(" ").length
          if (thisClass.doTranslation){
            if (wordCount > 0){
              thisClass.translate(text, (err, translatedText) => {
                thisClass.transcript.translation = translatedText
                if (wordCount > 4){
                  thisClass.analyze(text, (err, data) => {
                    server.sendEvents(thisClass.transcript)
                  })
                }else{
                  server.sendEvents(thisClass.transcript)
                }
              })
            }else
              server.sendEvents(thisClass.transcript)
          }else{
            if (wordCount > 4){
              thisClass.analyze(text, (err, data) => {
                server.sendEvents(thisClass.transcript)
              })
            }else{
              server.sendEvents(thisClass.transcript)
            }
          }
        }else{
          server.sendEvents(thisClass.transcript)
        }
      }else{
        console.log("speaker_labels avail.")
/*
        console.log("Speakers")
        console.log(evt)
        if (res.hasOwnProperty('speaker_labels')){
          for (var speaker of res.speaker_labels){
            var item = {
              time: speaker.from,
              speaker: speaker.speaker,
              final: speaker.final
            }
            //if (speakersText[speaker.speaker.toString()] !== undefined)
            thisClass.speakersText[speaker.speaker.toString()] = ""
            console.log(thisClass.speakersText[speaker.speaker.toString()] + " expected")
            thisClass.speakersArr.push(item)
          }
          console.log("CHECK LEN: " + thisClass.wordsArr.length + " == " + thisClass.speakersArr.length)
          console.log("Words: " + JSON.stringify(thisClass.wordsArr))
          console.log("Speakers: " + JSON.stringify(thisClass.speakersArr))
          ////
          if (thisClass.wordsArr.length == thisClass.speakersArr.length){
            console.log("BEFORE: " + JSON.stringify(thisClass.speakersText))
            for (var i=0; i<thisClass.wordsArr.length; i++){
              var word = thisClass.wordsArr[i].word
              var speakerId = thisClass.speakersArr[i].speaker
              if (word != '%HESITATION'){
                console.log(word)
                thisClass.speakersText[speakerId.toString()] += word + " "
              }
            }

            console.log("AFTER: " + JSON.stringify(thisClass.speakersText))
            // reset
            //thisClass.speakersArr = []
            //thisClass.wordsArr = []
          }else{
            console.log("waiting for more words")
          }
          ////
        }
*/
      }
        //
    });
  },
  closeConnection: function(){
    ws.close()
  },
  enableTranslation: function(flag){
    console.log("enableTranslation: " + flag)
    this.doTranslation = flag
  },
  transcribe: function(bufferStream) {
    ws.send(bufferStream, {
      binary: true,
      mask: true,
    });
  },
  translate: function(text, callback){
    var translateParams = {
      text: text.trim(),
      model_id: 'en-zh',
    };

    this.languageTranslator.translate(translateParams)
      .then(translationResult => {
        callback(null, translationResult.translations[0].translation)
      })
      .catch(err => {
        console.log('error:', err);
        callback(err.message, "")
      });
  },
  analyze: function(text, callback){
    var parameters = {
      'text': text,
      'features': {
        'keywords': {
          'emotion': true,
          'sentiment': true,
          'limit': 3
        }
        //'concepts': {},
        //'categories': {},
        //'entities': {
        //  'emotion': true,
        //  'sentiment': true
        //},
      }
    }
    console.log("Analyze: " + text)
    var thisClass = this
    this.naturalLanguageUnderstanding.analyze(parameters)
      .then(analysisResults => {
          //console.log("Analyse: " + JSON.stringify(analysisResults, null, 2));
          // calculate scores
          /*
          var analysis = {
              sentimentScore: 0,
              sadnessScore: 0,
              joyScore: 0,
              fearScore: 0,
              disgustScore: 0,
              angerScore: 0
            }
          */
          if (analysisResults.keywords.length > 0){
            for (var keyword of analysisResults.keywords){
              console.log("Analyse: " + JSON.stringify(keyword))
              if (keyword.hasOwnProperty("sentiment")){
                thisClass.sentimentScore += keyword.sentiment.score
                var scaled = Math.floor((thisClass.sentimentScore / thisClass.sentimentCount) * 100)
                if (scaled > 0){
                  thisClass.transcript.analysis.sentimentScore = Math.ceil((scaled / 2) + 50)
                }else{
                  thisClass.transcript.analysis.sentimentScore = Math.ceil(scaled / 2) * -1
                }
                thisClass.sentimentCount++
              }
              if (keyword.hasOwnProperty('emotion')){
                thisClass.sadnessScore += keyword.emotion.sadness
                thisClass.joyScore += keyword.emotion.joy
                thisClass.fearScore += keyword.emotion.fear
                thisClass.disgustScore += keyword.emotion.disgust
                thisClass.angerScore += keyword.emotion.anger
                thisClass.transcript.analysis.sadnessScore = Math.floor((thisClass.sadnessScore / thisClass.emotionCount) * 100)
                thisClass.transcript.analysis.joyScore = Math.floor((thisClass.joyScore / thisClass.emotionCount) * 100)
                thisClass.transcript.analysis.fearScore = Math.floor((thisClass.fearScore / thisClass.emotionCount) * 100)
                thisClass.transcript.analysis.disgustScore = Math.floor((thisClass.disgustScore / thisClass.emotionCount) * 100)
                thisClass.transcript.analysis.angerScore = Math.floor((thisClass.angerScore / thisClass.emotionCount) * 100)
                thisClass.emotionCount++
              }
            }
          }
          callback(null, "")
      })
      .catch(err => {
          console.log('error:', err);
          callback(err.message, "")
      });
  }
}

module.exports = WatsonEngine;
