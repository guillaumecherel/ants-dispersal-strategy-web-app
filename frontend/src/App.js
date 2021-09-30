import {useState, useEffect} from 'react';
import './App.css';
import {Branch, Code, Commit, Run, mkRun, LaunchNotInitiated, LaunchInitiated, 
  LaunchSuccessful, LaunchFailed, addLogs, getLastLogDate} from './Core';
import {fetchBranches, fetchCommits, fetchAllRuns, launchRun, fetchNewLogs,
  fetchRunOutput, fetchRunResults} from './Requests';
import {BACKEND_HOST, BACKEND_PORT, DEFAULT_JOB_DIR, DEFAULT_OUTPUT_DIR,
  DEFAULT_SCRIPT, RUN_OUTPUT_UPDATE_INTERVAL, RUN_RESULTS_UPDATE_INTERVAL,
  RUN_LOGS_UPDATE_INTERVAL} from './Constants';
import embed from 'vega-embed';


function App(props) {
  const [flagUpdateRunList, setFlagUpdateRunList] = useState(false);
  const triggerUpdateRunList = () => setFlagUpdateRunList(!flagUpdateRunList);
  const [selectedRun, setSelectedRun] = useState(undefined);

  let mainView;
  if (selectedRun) {
    mainView = (
      <RunView 
        run={selectedRun}
        close={() => setSelectedRun(undefined)}
      />
    );
  } else {
    mainView = (
      <HomeView 
        triggerUpdateRunList={triggerUpdateRunList}
        onSelectRun={setSelectedRun}
        flagUpdateRunList={flagUpdateRunList}
      />
    );
  }

  return (
    <div className="App">
      {mainView}
    </div>
  );
}


function RunView(props) {
  return (
    <div className="run-view">
      <button onClick={props.close}>Back</button>
      <h1>Run {props.run.id}</h1>
      <p>Launched {props.run.date}</p>
      <p>Commit {props.run.code.commit_hash} (branch: {props.run.code.branch})</p>
      <p>{props.run.code.description}</p>
      <p>{props.run.state}</p>
      <RunResultsView 
        run={props.run}
      />
      <RunOutputView 
        run={props.run}
      />
      <RunLogsView
        run={props.run}
      />
    </div>
  );
}


function RunResultsView(props) {
  const [results, setResults] = useState(undefined);
  const runId = props.run.id;
  const [notificationArea, setNotification] = useNotificationArea();

  useEffect(() => {
    let gotResults = false;
    const fetch_ = () => (
      fetchRunResults(runId)
      .then(results => {
        if (results) {
          setResults(results);
          gotResults = true;
        }
      })
      .catch(setNotification)
    );

    fetch_();
    let timer = setInterval(() => {
        fetch_();
        if (gotResults) {
          clearInterval(timer);
        }
    }, RUN_RESULTS_UPDATE_INTERVAL);
    return () => clearTimeout(timer);
  }, []);

  const visu = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    data: {
      values: results?.data
    },
    transform: [
      {
        fold: [
          "nest_quality_assessment_error",
          "percentage_foragers",
          "number_nests",
          "exploring_phase"
        ],
        as: ["parameter", "value"]
      },
      {
        density: "value",
        groupby: ["colony_id", "parameter"],
      }
    ],
    facet: {
      row: {
        field: "colony_id",
        align: "none",
      },
      column: {
        field: "parameter",
        sort: [
          "nest_quality_assessment_error",
          "percentage_foragers",
          "number_nests",
          "exploring_phase"
        ],
        header: {
          titleOrient: "bottom",
          labelOrient: "bottom",
        }
      }
    },
    spec: {
      width:100,
      height: 60,
      mark: 'line',
      encoding: {
        y: {
          field: 'density',
          type: 'quantitative'
        },
        x: {
          field: 'value',
          type: 'quantitative',
          title: null,
        }
      }
    },
    resolve: {scale: {x: "independent", y: "independent"}},
  };

  useEffect(() => {
    embed('#vis', visu);
  })

  return (
    <div className="run-results-view">
      <h3>Run results</h3>
      {notificationArea}
      <div id="vis"></div>
    </div>
  );
}


function RunOutputView(props) {
  const [output, setOutput] = useState(undefined);
  const runId = props.run.id;
  const [notificationArea, setNotification] = useNotificationArea();

  useEffect(() => {
    let gotOutput = false;
    const fetch_ = () => (
      fetchRunOutput(runId)
      .then(output => {
        if (output) {
          setOutput(output);
          gotOutput = true;
        }
      })
      .catch(setNotification)
    );

    fetch_();
    let timer = setInterval(() => {
      fetch_();
      if (gotOutput) {
        clearInterval(timer);
      }
    }, RUN_OUTPUT_UPDATE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="run-output-view">
      <h3>Run output</h3>
      {notificationArea}
      <pre>{output}</pre>
    </div>
  );
}


function RunLogsView(props) {
  const [lastLogDate, setLastLogDate] = useState(new Date(0));
  const [logs, setLogs] = useState(undefined);
  const appendLogs = newLogs => setLogs(addLogs(logs, newLogs))
  const [notificationArea, setNotification] = useNotificationArea();
  const runId = props.run.id

  useEffect(() => {
    const fetch_ = () => (
      fetchNewLogs(runId, lastLogDate)
      .then(newLogs => {
        appendLogs(newLogs);
        setLastLogDate(getLastLogDate(newLogs));
      })
      .catch(setNotification)
    );

    fetch_();
    let timer = setInterval(fetch_, RUN_LOGS_UPDATE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  let logElements = [];
  for (let context in logs) {
    for (let log of logs[context]) {
      logElements.push(
        <div className="log">
          <p className="context">{context}</p>
          <p className="timestamp">{log.timestamp.toString()}</p>
          <p className="stdout">{log.stdout}</p>
          <p className="stderr">{log.stderr}</p>
        </div>
      );
    }
  }

  return (
    <div>
      <h3>Logs</h3>
      {logElements}
    </div>
  );
}


function HomeView(props) {
  return (
    <div className="home-view">
      <NewRunSetupTool 
        triggerUpdateRunList={props.triggerUpdateRunList}
      />
      <p>Or chose a run from the list below to see the logs and results:</p>
      <RunList
        onSelectRun={props.onSelectRun}
        flagUpdate={props.flagUpdateRunList}
      />
    </div>
  );
}


function NewRunSetupTool(props) {
  const [startingNewRun, setStartingNewRun] = useState(false);
  const [curBranch, setCurBranch] = useState(undefined);
  const [curCommit, setCurCommit] = useState(undefined);
  const [jobDir, setJobDir] = useState(DEFAULT_JOB_DIR);
  const [outputDir, setOutputDir] = useState(DEFAULT_OUTPUT_DIR);
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [notificationArea, setNotification] = useNotificationArea();

  const close = msg => {
    setCurBranch(undefined);
    setCurCommit(undefined);
    setStartingNewRun(false);
  };

  let upperPanel;
  if (!startingNewRun) {
    upperPanel = (<StartNewRunButton
      onClick={() => setStartingNewRun(true)}
    />);
  } else {
    upperPanel = (
      <div>
        <CodeSelector
          curBranch={curBranch}
          curCommit={curCommit}
          onSelectBranch={setCurBranch}
          onSelectCommit={setCurCommit}
        />
        <RunConfig
          curCommit={curCommit}
          jobDir={jobDir}
          outputDir={outputDir}
          script={script}
          onSetJobDir={setJobDir}
          onSetOutputDir={setOutputDir}
          onSetScript={setScript}
        />
        <ConfirmStartNewRunButton
          curBranch={curBranch}
          curCommit={curCommit}
          onClick={() => {
            setNotification(new LaunchInitiated());
            (launchRun(mkRun(curCommit, curBranch, jobDir, outputDir, script))
              .then(runId => {
                setNotification(new LaunchSuccessful(runId));
                close();
                props.triggerUpdateRunList();
              })
              .catch(err => setNotification(new LaunchFailed(err)))
            );
          }}
        />
      </div>
    );
  }

  return (
    <div>
      {upperPanel}
      {notificationArea}
    </div>
  );
}


function StartNewRunButton(props) {
    return (<button 
      type="button"
      onClick={() => props.onClick()}>
        Start a new run
      </button>
    );
}


function RunConfig(props) {
  if (props.curCommit) {
    return (
      <div>
        <p>Run configuration:</p>
        <label>
          Job directory:
          <input type="text" 
            onChange={e => props.onSetJobDir(e.target.value)}
            value={props.jobDir}
          />
        </label>
        <label>
          Output directory:
          <input type="text"
            onChange={e => props.onSetOutputDir(e.target.value)}
            value={props.outputDir}
          />
        </label>
        <label>
          Script file:
          <input type="text"
            onChange={e => props.onSetScript(e.target.value)}
            value={props.script}
          />
        </label>
      </div>
    );
  } else {
    return (<div />);
  }
}


function ConfirmStartNewRunButton(props) {
  if (props.curBranch && props.curCommit) {
    return (
      <button
        type="button"
        disabled={false}
        onClick={props.onClick}
      >
        Start run.
      </button>
    );
  } else {
    return (<div />);
  }
}


function CodeSelector(props) {
  if (props.curBranch && props.curCommit) {
    return (
      <div>
        <SelectedCommitView
          curBranch={props.curBranch}
          curCommit={props.curCommit}
          onUnsetCommit={() => props.onSelectCommit(undefined)}
        />
      </div>
    );
  } else {
    return (
      <div>
        <BranchList
          onSelectBranch={props.onSelectBranch}
        />
        <CommitList
          branch={props.curBranch}
          onSelectCommit={props.onSelectCommit}
        />
      </div>
    );
  }
}


function BranchItem(props) {
  return (
    <li>
      <button 
        type="button"
        onClick={props.onClick}>
        {props.name}
      </button>
    </li>
  );
}


function SelectedCommitView(props) {
  return (
    <button
      type="button"
      onClick={props.onUnsetCommit}
    >
      <p className="hash"> Selected commit: {props.curCommit.hash}</p>
      <p className="branch">On branch: {props.curBranch.name}</p>
      <p className="date">{props.curCommit.date}</p>
      <p className="author">{props.curCommit.author}</p>
      <p className="message">{props.curCommit.message}</p>
      <p>(click to change)</p>
    </button>
  );
}


function BranchList(props) {
  const [branches, setBranches] = useState([]);
  const onSelectBranch = props.onSelectBranch;
  const [notificationArea, setNotification] = useNotificationArea();

  useEffect(() => {
    let isMounted = true;
    (fetchBranches()
      .then(bs => {
        if (isMounted) {
          setBranches(bs.map(b => (
            <BranchItem
              key={b.name}
              name = {b.name}
              onClick={() => onSelectBranch(b)}
            />
          )));
        }
      })
      .catch(setNotification)
    );

    return () => { isMounted = false };
  }, [onSelectBranch, setNotification]);

  return (
    <div>
      <p>Branches:</p>
      {notificationArea}
      <ul>{branches}</ul>
    </div>
  );
}


function useNotificationArea() {
  const [notification, setNotification] = useState(undefined);

  let message;
  let messageClass = "info";
  if (notification === undefined) {
    message = "";
  } else if (typeof notification == "string") {
    message = notification;
  } else if (notification instanceof LaunchNotInitiated) {
    message = "";
  } else if (notification instanceof LaunchInitiated) {
    message = "Launching... it may take a few seconds";
  } else if (notification instanceof LaunchSuccessful) {
    message = "Launch successful! Run id: " + notification.runId;
    messageClass += " success";
  } else if (notification instanceof LaunchFailed) {
    message = "Launch failed. Error: " + notification.error;
    messageClass += " warning";
  } else if (notification instanceof Error){
    message = setNotification.toString();
    messageClass += " warning";
  } else {
    message = setNotification.toString();
  }

  const notificationArea = (
    <p className={"notification-area " + messageClass}>
      {message}
    </p>
  );

  return [notificationArea, setNotification]
}


function CommitList(props) {
  const [commits, setCommits] = useState([]);
  const branch = props.branch;
  const onSelectCommit = props.onSelectCommit;
  const [notificationArea, setNotification] = useNotificationArea();

  useEffect(() => {
    let isMounted = true;
    if (branch !== undefined) {
      (fetchCommits(branch.name)
        .then(cs => {
          if (isMounted) {
            setCommits(cs.map(c => (
              <CommitItem
                key={c.hash}
                commit={c}
                onClick={() => onSelectCommit(c)}
              />
            )));
          }
        })
        .catch(setNotification)
      );
    }
    return () => { isMounted = false };
  }, [branch, onSelectCommit, setNotification]);

  return (
    <div>
      <p>Commits:</p>
      {notificationArea}
      <ul>{commits}</ul>
    </div>
  );
}


function CommitItem(props) {
  const c = props.commit;
  return (
    <li>
      <button 
        type="button"
        onClick={props.onClick}>
          <p className="hash">{c.hash}</p>
          <p className="date">{c.date}</p>
          <p className="author">{c.author}</p>
          <p className="message">{c.message}</p>
      </button>
    </li>
  );
}


function RunList(props) {
  const [runs, setRuns] = useState([]);
  const onSelectRun = props.onSelectRun;
  const flagUpdate = props.flagUpdate;
  const [notificationArea, setNotification] = useNotificationArea();

  useEffect(() => {
    (fetchAllRuns()
      .then(rs => setRuns(rs.map(r =>
        (
          <RunItem
            key={r.id}
            run={r}
            onClick={() => onSelectRun(r)}
          />
        )
      )))
      .catch(setNotification)
    );
  }, [onSelectRun, flagUpdate, setNotification]);

  return (
    <div>
      {notificationArea}
      <ul>{runs}</ul>
    </div>
  );
}


function RunItem(props) {
  return (
    <li>
      <button 
        type="button"
        onClick={props.onClick}>
        <p>Run {props.run.id}</p>
        <p>{props.run.date}</p>
        <p>Commit {props.run.code.commit_hash}</p>
        <p>{props.run.code.description}</p>
        <p>{props.run.state}</p>
        <p></p>
      </button>
    </li>
  );
}


function WithNotification(props) {
  const [notification, setNotification] = useState([]);

  return (
    <div>
      <NotificationArea message={notification} />
      {props.content(setNotification)}
    </div>
  );
}


function NotificationArea(props) {
  return <div className="notification-area">{props.message}</div>;
}


export default App;
