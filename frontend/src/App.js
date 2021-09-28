import {useState, useEffect} from 'react';
import './App.css';
import {Branch, Code, Commit, Run, mkRun, LaunchNotInitiated, LaunchInitiated, 
  LaunchSuccessful, LaunchFailed} from './Core';
import {fetchBranches, fetchCommits, fetchAllRuns, launchRun, HttpError} from './Requests';
import {BACKEND_HOST, BACKEND_PORT, DEFAULT_JOB_DIR, DEFAULT_OUTPUT_DIR, 
  DEFAULT_SCRIPT} from './Constants';

function App(props) {
  const [flagUpdateRunList, setFlagUpdateRunList] = useState(false)
  const triggerUpdateRunList = () => setFlagUpdateRunList(!flagUpdateRunList)

  return (
    <div className="App">
      <NewRunSetupTool 
        triggerUpdateRunList={triggerUpdateRunList}/>
      <p>Or chose a run from the list below to see the logs and results:</p>
      <RunList
        onSelectRun={r => alert("Selected run " + r.id)}
        flagUpdate={flagUpdateRunList}
      />
    </div>
  );
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
