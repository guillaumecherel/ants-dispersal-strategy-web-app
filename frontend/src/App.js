import {useState, useEffect} from 'react';
import './App.css';
import {Branch, Code, Commit, Run, mkRun, LaunchNotInitiated, LaunchInitiated, 
  LaunchSuccessful, LaunchFailed} from './Core';

//TODO: Move this to proper config
const BACKEND_HOST = "localhost";
const BACKEND_PORT = "8888";
const DEFAULT_JOB_DIR = "openmole";
const DEFAULT_OUTPUT_DIR = "output";
const DEFAULT_SCRIPT = "Colony_fission_ABC.oms";


async function fetchBranches() {
    return (fetch(new URL("https://gitlab.openmole.org/api/v4/projects/42/repository/branches"))
      .then(result => result.json())
      .then(json => json.map(branch => new Branch(branch.name))));
}


async function fetchCommits(branch) {
    let req = new URL("https://gitlab.openmole.org/api/v4/projects/42/repository/commits");
    req.searchParams.set("ref_name", branch);
    return (fetch(req)
      .then(result => result.json())
      .then(json => json.map(commit => {
        return new Commit(commit.id, commit.authored_date, commit.author_name,
          commit.message)
      })));
}


async function fetchAllRuns(branch) {
  let req = new URL("http://" + BACKEND_HOST + ":" + BACKEND_PORT + "/all_runs");
  return (fetch(req)
    .then(result => result.json())
    .then(json => json.map(run => {
      return new Run(
        run.id,
        new Code(
          run.code.commit_hash,
          run.code.branch,
          run.code.description,
        ),
        run.date,
        run.job_dir,
        run.output_dir,
        run.script,
        run.state
      )
    }))
  );
}


async function launchRun(run) {
  let req = new URL("http://" + BACKEND_HOST + ":" + BACKEND_PORT + "/launch/" + run.code.commit_hash);
  req.searchParams.set("branch", run.code.branch.name)
  req.searchParams.set("description", run.code.description)
  req.searchParams.set("timestamp", run.date)
  req.searchParams.set("job_dir", run.job_dir)
  req.searchParams.set("output_dir", run.output_dir)
  req.searchParams.set("script", run.script)
  return (fetch(req)
    .then(result => result.text())
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
  const [launchFeedback, setLaunchFeedback] = useState(new LaunchNotInitiated());

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
            setLaunchFeedback(new LaunchInitiated());
            (launchRun(mkRun(curCommit, curBranch, jobDir, outputDir, script))
              .then(runId => {
                setLaunchFeedback(new LaunchSuccessful(runId));
                close();
                props.triggerUpdateRunList();
              })
              .catch(err => setLaunchFeedback(new LaunchFailed(err)))
            );
          }}
        />
      </div>
    );
  }

  return (
    <div>
      {upperPanel}
      <StartNewRunFeedbackArea
        launchFeedback={launchFeedback}
      />
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


function StartNewRunFeedbackArea(props) {
  let feedback;
  let className = "launch-feedback";
  if (props.launchFeedback instanceof LaunchNotInitiated) {
    feedback = "";
  } else if (props.launchFeedback instanceof LaunchInitiated) {
    feedback = "Launching... it may take a few seconds";
  } else if (props.launchFeedback instanceof LaunchSuccessful) {
    feedback = "Launch successful! Run id: " + props.launchFeedback.runId;
    className += " success";
  } else if (props.launchFeedback instanceof LaunchFailed) {
    feedback = "Launch failed. Error: " + props.launchFeedback.error;
    className += " danger";
  }

  return (
    <p className={className}>{feedback}</p>
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
    );
    return () => { isMounted = false };
  }, [onSelectBranch]);

  return (
    <div>
      <p>Branches:</p>
      <ul>{branches}</ul>
    </div>
  );
}


function CommitList(props) {
  const [commits, setCommits] = useState([]);
  const branch = props.branch;
  const onSelectCommit = props.onSelectCommit;

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
        }));
    }
    return () => { isMounted = false };
  }, [branch, onSelectCommit]);

  return (
    <div>
      <p>Commits:</p>
      <ul>{commits}</ul>
    </div>
  );
}


function RunList(props) {
  const [runs, setRuns] = useState([]);
  const onSelectRun = props.onSelectRun;
  const flagUpdate = props.flagUpdate;

  useEffect(() => {
    (fetchAllRuns()
      .then(rs => rs.map(r =>
        (
          <RunItem
            key={r.id}
            run={r}
            onClick={() => onSelectRun(r)}
          />
        )
      ))
      .then(rs => setRuns(rs))
    );
  }, [onSelectRun, flagUpdate]);

  return (<ul>{runs}</ul>);
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

export default App;
