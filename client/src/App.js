import React, { Component } from 'react';
//import { StyleSheet, Text, View, FlatList } from 'react-flatlist';
//import { getInitialCallTranscript } from './DataProvider';
//import 'react-table/react-table.css';
//import ajax from './service/FetchData';
// , LinearGauge, RadialGauge
import {
    ArcGauge
} from '@progress/kendo-react-gauges';

import axios from "axios";

export default class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      dialogue: [],
      phoneStatus: "idle",
      sentimentScore: 0,
      sadnessScore: 0,
      joyScore: 0,
      fearScore: 0,
      disgustScore: 0,
      angerScore: 0
    };

    this.cannotRecord = true
    this.recordingButtonName = 'Start Recording'
    this.isRecording = false

    this.buttonName = 'Enable Translation'
    this.doTranslation = false

    this.eventSource = new EventSource('http://localhost:5000/events');
  }
  async componentDidMount() {
    this.eventSource.addEventListener('transcriptUpdate', (e) => this.updateTranscript(JSON.parse(e.data)));
    this.eventSource.addEventListener('phoneEvent', (e) => this.updatePhoneStatus(JSON.parse(e.data)));
    this.eventSource.addEventListener('closedConnection', () => this.stopUpdates());
/*
    setInterval(
            () => {
                this.setState({
                    sentimentScore: Math.ceil(Math.random() * 100)
                });
            },  1000);

    setInterval(
            () => {
                this.setState({
                   sadnessScore: Math.ceil(Math.random() * 100)
                });
                //console.log(this.state.sadnessScore)
            },  1000);
*/
  }

  updateTranscript(transcript) {
    /*
    let newData = this.state.data.map((item) => {
      if (item.transcript === transcript.transcript) {
        item.transcript = transcript.transcript;
      }
      return item;
    });
    */
    //console.log(transcript.transcript)
    this.update = false
    //console.log("========")

    for (let i = 0; i < this.state.dialogue.length; i++) {
      if (this.state.dialogue[i].index === transcript.index){
        let items = [...this.state.dialogue];
        let item = {...items[i]};
        //console.log("before: " + item.text)
        item.text = transcript.text;
        item.translation = transcript.translation;
        items[i] = item;

        this.setState(Object.assign({}, {dialogue: items}));
        //console.log("after: " + item.text)
        this.update = true
        break
      }
    }
    if (!this.update){
      this.state.dialogue.unshift(transcript)
      this.setState(Object.assign({}, {dialogue: this.state.dialogue}));
    }
    if (transcript.status && transcript.analysis.hasOwnProperty("sentimentScore")){
      this.setState({sentimentScore: transcript.analysis.sentimentScore})
      this.setState({sadnessScore: transcript.analysis.sadnessScore})
      this.setState({joyScore: transcript.analysis.joyScore})
      this.setState({fearScore: transcript.analysis.fearScore})
      this.setState({disgustScore: transcript.analysis.disgustScore})
      this.setState({angerScore: transcript.analysis.angerScore})
    }
    /*
    let newData = this.state.dialogue.map((item) => {
      if (item.index === transcript.index) {
        item.text = transcript.text;
        this.update = true
      }
      return item;
    });

    if (this.update){
      this.setState(Object.assign({}, {dialogue: newData}));
    }else{
      this.state.dialogue.unshift(transcript)
      this.setState(Object.assign({}, {dialogue: this.state.dialogue}));
    }
    */
  }

  updatePhoneStatus(phoneStatus) {
    console.log(phoneStatus.status)
    if (phoneStatus.status === "connected"){
      this.clearTranscript()
      this.cannotRecord = false
    }else{
      this.cannotRecord = true
    }
    this.setState(Object.assign({}, {phoneStatus: phoneStatus.status}));
  }

  stopUpdates() {
    this.eventSource.close();
  }

  clearTranscript() {
    this.setState(Object.assign({}, {dialogue: []}));
    this.setState({sentimentScore: 0})
    this.setState({sadnessScore: 0})
    this.setState({joyScore: 0})
    this.setState({fearScore: 0})
    this.setState({disgustScore: 0})
    this.setState({angerScore: 0})
  }

  async recordingCall() {
    if (this.isRecording){
      this.isRecording = false
      this.recordingButtonName = 'Start Recording'
    }else{
      this.isRecording = true
      this.recordingButtonName = 'Stop Recording'
    }
    this.setState(Object.assign({}, {}));
    const response =
      await axios.get("http://localhost:5000/recording",
          { params: {enable: this.isRecording}}
      )

    console.log(response.data)
  }

  async enableTranslation() {
    if (this.doTranslation){
      this.doTranslation = false
      this.buttonName = 'Enable Translation'
    }else{
      this.doTranslation = true
      this.buttonName = 'Disable Translation'
    }
    this.setState(Object.assign({}, {}));
    const response =
      await axios.get("http://localhost:5000/enable_translation",
          { params: {enable: this.doTranslation}}
      )

    console.log(response.data)
  }

  async getDataAxios(){
    /*
      const response =
        await axios.get("http://localhost:5000/login",
            { params: {name: 'bruno'}}
        )
      this.buttonName = 'Logout'
      console.log(response.data)
      */
  }

  render() {
    if (this.doTranslation){
      this.items = this.state.dialogue.map((item, key) =>
        <div key={item.index} >
          <div> Speaker {item.speaker}: {item.text} </div>
          <div className="translation"> Translated: {item.translation} </div>
        </div>
      );
    }else{
      this.items = this.state.dialogue.map((item, key) =>
        <div key={item.index} >
          <div> Speaker {item.speaker}: {item.text} </div>
        </div>
      );
    }
    const colors = [
                { from: 0, to: 50, color: 'red' },
                { from: 50, to: 100, color: 'lime' }
            ];

    const sentimentOptions = {
        value: this.state.sentimentScore,
        colors
    };

    const arcCenterRenderer = (value, color) => {
        return (<h3 style={{ color: color }}>{value}%</h3>);
    };

/*
    const linearOptions = {
        pointer: {
            value: this.state.sadnessScore
        }
    };
  */

    const sadnessOptions = {
        value: this.state.sadnessScore,
        colors: [
                    { from: 0, to: 50, color: 'lime' },
                    { from: 50, to: 100, color: 'red' }
                ]
    };
    const joyOptions = {
            value: this.state.joyScore,
            colors: [
                        { from: 0, to: 30, color: 'red' },
                        { from: 30, to: 100, color: 'lime' }
                    ]
    };

    const fearOptions = {
            value: this.state.fearScore,
            colors: [
                        { from: 0, to: 30, color: 'yellow' },
                        { from: 30, to: 60, color: 'orange' },
                        { from: 60, to: 100, color: 'red' }
                    ]
    };

    const disgustOptions = {
            value: this.state.disgustScore,
            colors: [
                        { from: 0, to: 30, color: 'yellow' },
                        { from: 30, to: 60, color: 'orange' },
                        { from: 60, to: 100, color: 'red' }
                    ]
    };

    const angerOptions = {
            value: this.state.angerScore,
            colors: [
                        { from: 0, to: 30, color: 'yellow' },
                        { from: 30, to: 60, color: 'orange' },
                        { from: 60, to: 100, color: 'red' }
                    ]
    };
    return (
      <div className="App">
        <span>Phone status: {this.state.phoneStatus} </span> &nbsp;
        <button onClick={() => this.clearTranscript()}>Clear Transcript</button> &nbsp;
        <button disabled={this.cannotRecord} onClick={() => this.recordingCall()}>{this.recordingButtonName}</button> &nbsp;
        <button onClick={() => this.enableTranslation()}>{this.buttonName}</button>
        <br/><br/>
        <div className="columns">
          <div className="conversations">
            {this.items}
          </div>
          <div className="infoColumn">
            <div>
              <div>
              <ArcGauge {...sentimentOptions} arcCenterRender={arcCenterRenderer} />
              Sentiment
              </div>
            </div>
            <div>
              <div>
              <ArcGauge {...sadnessOptions} arcCenterRender={arcCenterRenderer} />
              Sadness
              </div>
            </div>
            <div>
              <div>
              <ArcGauge {...joyOptions} arcCenterRender={arcCenterRenderer} />
              Joy
              </div>
            </div>
            <div>
              <div>
              <ArcGauge {...fearOptions} arcCenterRender={arcCenterRenderer} />
              Fear
              </div>
            </div>
            <div>
              <div>
                <ArcGauge {...disgustOptions} arcCenterRender={arcCenterRenderer} />
              Disgust
              </div>
            </div>
            <div>
              <div>
                <ArcGauge {...angerOptions} arcCenterRender={arcCenterRenderer} />
              <div>Anger</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
