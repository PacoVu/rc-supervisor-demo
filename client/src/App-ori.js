import React, { Component } from 'react';
//import ReactTable from 'react-table';
import FlatList from 'react-native';
import { getInitialCallTranscript } from './DataProvider';
//import 'react-table/react-table.css';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: getInitialCallTranscript()
    };

    this.columns = [{
      Header: 'Speaker',
      accessor: 'speaker'
    }, {
      Header: 'Transcript',
      accessor: 'transcript'
    }, {
      Header: 'Timestamp',
      accessor: 'timestamp'
    }];

    this.eventSource = new EventSource('http://localhost:5000/events');
  }

  componentDidMount() {
    this.eventSource.addEventListener('transcriptUpdate', (e) => this.updateTranscript(JSON.parse(e.data)));
    //this.eventSource.addEventListener('transcriptRemoval', (e) => this.removeTranscript(JSON.parse(e.data)));
    this.eventSource.addEventListener('closedConnection', () => this.stopUpdates());
  }

  updateTranscript(transcript) {
    let newData = this.state.data.map((item) => {
      if (item.transcript === transcript.transcript) {
        item.transcript = transcript.transcript;
      }
      return item;
    });

    this.setState(Object.assign({}, {data: newData}));
  }
/*
  removeTranscript(flightInfo) {
    const newData = this.state.data.filter((item) => item.transcript !== flightInfo.flight);

    this.setState(Object.assign({}, {data: newData}));
  }
*/
  stopUpdates() {
    this.eventSource.close();
  }

  render() {
    return (
      <div className="App">
        <button onClick={() => this.stopUpdates()}>Stop updates</button>
        <div>
          {this.state.data}
        </div>
      </div>
    );
  }
}

export default App;
