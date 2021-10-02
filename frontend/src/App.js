import {useState, useEffect} from 'react';
import './App.css';
import {mkRun, LaunchNotInitiated, LaunchInitiated, 
  LaunchSuccessful, LaunchFailed, addLogs, getLastLogDate} from './Core';
import {fetchBranches, fetchCommits, fetchAllRuns, launchRun, fetchNewLogs,
  fetchRun, fetchRunOutput, fetchRunResults} from './Requests';
import {DEFAULT_JOB_DIR, DEFAULT_OUTPUT_DIR,
  DEFAULT_SCRIPT, RUN_STATE_UPDATE_INTERVAL, RUN_OUTPUT_UPDATE_INTERVAL, 
  RUN_RESULTS_UPDATE_INTERVAL, RUN_LOGS_UPDATE_INTERVAL} from './Constants';
import {formatDate, shortDate} from './Util';
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
    <section className="section">
      <div className="container is-max-desktop">
        <h1 className="title has-text-centered">Ant dispersal strategy simulation experiments</h1>
        <div className="columns is-centered">
          <div className="column">
            {mainView}
          </div>
        </div>
      </div>
    </section>
  );
}


function RunView(props) {
  const [run, setRun] = useState(props.run);
  const runId = props.run.id;

  useEffect(() => {
    let isRunning = true;
    const fetch_ = () => {
      (fetchRun(runId)
        .then(run => {
          setRun(run);
          isRunning = run.state === "Running";
        })
      );
    }

    fetch_();
    let timer = setInterval(() => {
        if (!isRunning) {
          clearInterval(timer);
        } else {
          fetch_();
        }
    }, RUN_STATE_UPDATE_INTERVAL);
    return () => clearTimeout(timer);
  }, [runId]);

  return (
    <div>
      <button className="block button" onClick={props.close}>Back</button>

      <div className="block">
        <RunCard run={run}/>
      </div>

      <RunResultsView
        run={run}
      />
      <RunOutputView
        run={run}
      />
      <RunLogsView
        run={run}
      />
    </div>
  );
}


function RunResultsView(props) {
  const [results, setResults] = useState(undefined);
  const runId = props.run.id;
  const runState = props.run.state;
  const [notificationArea, setNotification] = useNotificationArea("Loading…");

  useEffect(() => {
    const isRunning = runState === "Running";
    let gotResults;
    const fetch_ = () => {
      (fetchRunResults(runId)
        .then(results => {
          gotResults = results.length !== 0;
          if (gotResults) {
            setResults(results);
            setNotification(undefined);
          } else {
            setNotification("Waiting for some results…");
          }
        })
        .catch(setNotification)
      );
    };

    fetch_();
    let timer = setInterval(() => {
        if (isRunning || !gotResults) {
          fetch_();
        } else {
          clearInterval(timer);
        }
    }, RUN_RESULTS_UPDATE_INTERVAL);
    return () => clearTimeout(timer);
  }, [runId, runState, setNotification]);

  const visu = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    data: {
      values: results
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
          type: 'quantitative',
        },
        x: {
          field: 'value',
          type: 'quantitative',
        }
      }
    },
    resolve: {scale: {x: "independent", y: "independent"}},
    config: {
      facet: {
        spacing: 5,
      }
    },
  };

  useEffect(() => {
    if (results) {
      embed('#vis', visu);
    }
  })

  return (
    <div className="">
      <h3 className="subtitle">Run results</h3>
      {notificationArea}
      <div id="vis"></div>
    </div>
  );
}


function RunOutputView(props) {
  const [output, setOutput] = useState(undefined);
  const runId = props.run.id;
  const runState = props.run.state;
  const [notificationArea, setNotification] = useNotificationArea();

  useEffect(() => {
    let isRunning = true;
    const fetch_ = () => {
      (fetchRunOutput(runId)
        .then(output => {
          if (output) {
            setOutput(output);
          }
          isRunning = runState === "Running";
        })
        .catch(setNotification)
      );
    }

    fetch_();
    let timer = setInterval(() => {
      if (!isRunning) {
        clearInterval(timer);
      } else {
        fetch_();
      }
    }, RUN_OUTPUT_UPDATE_INTERVAL);
    return () => clearInterval(timer);
  }, [runId, runState, setNotification]);

  return (
    <div className="columns">
    <div className="column is-centered is-full">
      <h2 className="subtitle">Run output</h2>
      {notificationArea}
      <div className="break-words is-family-monospace">{output}</div>
    </div>
    </div>
  );
}


function RunLogsView(props) {
  const [logs, setLogs] = useState(undefined);
  const [notificationArea, setNotification] = useNotificationArea();
  const runId = props.run.id;
  const runState = props.run.state;

  useEffect(() => {
    let lastLogDate = new Date(0);
    const fetch_ = () => (
      fetchNewLogs(runId, lastLogDate)
      .then(newLogs => {
        if (newLogs) {
          setLogs(l => addLogs(l, newLogs));
          lastLogDate = getLastLogDate(newLogs);
        }
      })
      .catch(setNotification)
    );

    fetch_();
    let timer = setInterval(() => {
      if (runState !== "Running") {
        clearInterval(timer);
      } else {
        fetch_()
      }
    }, RUN_LOGS_UPDATE_INTERVAL);
    return () => clearInterval(timer);
  }, [runId, runState, setNotification]);

  let logElements = [];
  for (let context in logs) {
    for (let log of logs[context]) {
      logElements.push(
        <div className="columns has-background-light mb-4">
          <div className="column is-2">
            <p className="tag">{context}</p>
            <p className="">{shortDate(log.timestamp)}</p>
          </div>
          <div className="column">
            <p className="block is-family-monospace break-words p-3 m-0 mb-3 has-background-white">Stdout: {log.stdout}</p>
            <p className="block is-family-monospace break-words p-3 m-0 has-background-white">Stderr: {log.stderr}</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div>
      <h2 className="subtitle">Logs</h2>
      {notificationArea}
      {logElements}
    </div>
  );
}


function HomeView(props) {
  return (
    <div>
      <NewRunSetupTool 
        triggerUpdateRunList={props.triggerUpdateRunList}
      />
      <p className="block mt-5">Or choose a run from the list below to see the logs and results:</p>
      <RunMenu
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
    upperPanel = (
      <StartNewRunButton
        onClick={() => setStartingNewRun(true)}
      />
    );
  } else {
    upperPanel = (
      <div className="box">
        <div className="columns is-centered">
          <div className="column">
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
                  .then(run => {
                    setNotification(new LaunchSuccessful(run));
                    close();
                  })
                  .catch(err => setNotification(new LaunchFailed(err)))
                );
                props.triggerUpdateRunList();
              }}
            />
          </div>
        </div>
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
    return (
      <div className="columns is-centered">
        <div className="column is-narrow">
          <a
            className="box has-background-info-light"
            onClick={() => props.onClick()}
          >
            Start a new run
          </a>
        </div>
      </div>
    );
}


function RunConfig(props) {
  if (props.curCommit) {
    return (
      <div className="columns is-centered">
        <div className="column">
          <h3 class="subtitle">Run configuration:</h3>
          <p>
            <label>
              Job directory: 
              <input type="text" 
                onChange={e => props.onSetJobDir(e.target.value)}
                value={props.jobDir}
              />
            </label>
          </p>
          <p>
            <label>
              Output directory:
              <input type="text"
                onChange={e => props.onSetOutputDir(e.target.value)}
                value={props.outputDir}
              />
            </label>
          </p>
          <p>
            <label>
              Script file:
              <input type="text"
                onChange={e => props.onSetScript(e.target.value)}
                value={props.script}
              />
            </label>
          </p>
        </div>
      </div>
    );
  } else {
    return (<div />);
  }
}


function ConfirmStartNewRunButton(props) {
  if (props.curBranch && props.curCommit) {
    return (
      <div>
        <button
          className="button is-primary"
          type="button"
          disabled={false}
          onClick={props.onClick}
        >
          Start run.
        </button>
      </div>
    );
  } else {
    return (<div />);
  }
}


function CodeSelector(props) {
  if (props.curBranch && props.curCommit) {
    return (
      <SelectedCommitView
        curBranch={props.curBranch}
        curCommit={props.curCommit}
        onUnsetCommit={() => props.onSelectCommit(undefined)}
      />
    );
  } else {
    return (
      <div className="columns">
        <div className="column is-one-quarter">
          <BranchMenu
            curBranch = {props.curBranch}
            onSelectBranch={props.onSelectBranch}
          />
        </div>
        <div className="column">
          <CommitMenu
            branch={props.curBranch}
            onSelectCommit={props.onSelectCommit}
          />
        </div>
      </div>
    );
  }
}


function BranchItem(props) {
  return (
    <li>
      <a
        className={(props.curBranch?.name === props.name ? " is-active" : "")}
        onClick={props.onClick}
      >
        {props.name}
      </a>
    </li>
  );
}


function SelectedCommitView(props) {
  const c = props.curCommit;

  return (
    <div className="columns is-centered">
    <div className="column">
      <div className="box has-background-info-light">
        <a className="has-text-dark" onClick={props.onUnsetCommit}>
          <h3 className="subtitle"> Selected commit: (click to change)</h3>
          <div className="columns is-mobile">
            <div className="column is-two-thirds pb-0">
              <p className="">{c.message}</p>
            </div>
            <div className="column is-one-third pb-0 has-text-right">
              <p className="">{c.author}</p>
            </div>
          </div>
          <div className="columns is-centered is-mobile">
            <div className="column is-two-thirds pt-1">
              <p className="">{formatDate(c.date)}</p>
            </div>
            <div className="column is-one-third pt-1 has-text-right">
              <p className="tag">{c.hash.slice(0,7)}</p>
            </div>
          </div>
        </a>
      </div>
    </div>
    </div>
  );
}


function BranchMenu(props) {
  const [branches, setBranches] = useState([]);
  const [notificationArea, setNotification] = useNotificationArea();
  const onSelectBranch = props.onSelectBranch;
  const curBranch = props.curBranch

  useEffect(() => {
    let isMounted = true;
    (fetchBranches()
      .then(bs => {
        if (isMounted) {
          setBranches(bs.map(b => (
            <BranchItem
              key={b.name}
              name = {b.name}
              curBranch = {curBranch}
              onClick={() => onSelectBranch(b)}
            />
          )));
        }
      })
      .catch(setNotification)
    );

    return () => { isMounted = false };
  }, [curBranch, onSelectBranch, setNotification]);

  return (
    <div className="menu">
      <p className="menu-label">Branches:</p>
      {notificationArea}
      <ul className="menu-list">{branches}</ul>
    </div>
  );
}


function useNotificationArea(msg) {
  const [notification, setNotification] = useState(msg);

  let message;
  let messageClass = "";
  if (notification === undefined) {
    message = "";
  } else if (typeof notification == "string") {
    message = notification;
  } else if (notification instanceof LaunchNotInitiated) {
    message = "";
  } else if (notification instanceof LaunchInitiated) {
    message = "Launching... it may take a few seconds";
  } else if (notification instanceof LaunchSuccessful) {
    message = "Successfully launched run " + notification.run.id;
    messageClass = "is-success";
  } else if (notification instanceof LaunchFailed) {
    message = "Launch failed. Error: " + notification.error;
    messageClass = "is-danger";
  } else if (notification instanceof Error){
    message = notification.message;
    messageClass = "is-danger";
  } else {
    message = notification.toString();
  }


  let notificationArea
  if (message) {
    console.log(message);
    notificationArea = (
      <div className={"notification break-words " + messageClass}>
        {message}
      </div>
    );
  } else {
    notificationArea = (<></>);
  }

  return [notificationArea, setNotification]
}


function CommitMenu(props) {
  const [commits, setCommits] = useState([]);
  const branch = props.branch;
  const onSelectCommit = props.onSelectCommit;
  const [notificationArea, setNotification] = useNotificationArea();

  useEffect(() => {
    let isMounted = true;
    if (branch) {
      setNotification(undefined);
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
    } else {
      setNotification("Please select a branch");
    }
    return () => { isMounted = false };
  }, [branch, onSelectCommit, setNotification]);

  return (
    <div className="menu">
      <p className="menu-label">Commits:</p>
      {notificationArea}
      <ul className="menu-list">{commits}</ul>
    </div>
  );
}


function CommitItem(props) {
  const c = props.commit;
  return (
    <li className="has-background-info-light mb-2">
      <a
        className=""
        onClick={props.onClick}
      >
          <div className="columns is-mobile">
            <div className="column is-two-thirds pb-0">
              <p>{c.message}</p>
            </div>
            <div className="column is-one-third pb-0 has-text-right">
              <p>{c.author}</p>
            </div>
          </div>
          <div className="columns is-mobile">
            <div className="column is-two-thirds pt-1">
              <p>{formatDate(c.date)}</p>
            </div>
            <div className="column is-one-third pt-1 has-text-right">
              <p className="tag">{c.hash.slice(0,7)}</p>
            </div>
          </div>
      </a>
    </li>
  );
}


function RunMenu(props) {
  const [runs, setRuns] = useState([]);
  const onSelectRun = props.onSelectRun;
  const flagUpdate = props.flagUpdate;
  const [notificationArea, setNotification] = useNotificationArea();

  useEffect(() => {
    const fetch_ = () => (fetchAllRuns()
      .then(rs => setRuns(rs.map(r =>
        (
          <li key={r.id} className="mb-2 mt-0">
            <a onClick={() => onSelectRun(r)} className="p-0 m-0">
              <RunCard run={r} />
            </a>
          </li>
        )
      )))
      .catch(setNotification)
    );

    fetch_();
    let timer = setInterval(fetch_, RUN_STATE_UPDATE_INTERVAL);
    return () => clearTimeout(timer);
  }, [onSelectRun, flagUpdate, setNotification]);

  return (
    <div className="columns">
      <div className="column">
        {notificationArea}
        <div className="menu">
          <ul className="menu-list">{runs}</ul>
        </div>
      </div>
    </div>
  );
}

function RunCard(props) {
  const runState = props.run.state;

  const stateColor = (
    runState === "Finished" ? "success":
    runState === "Failed" ? "danger":
    runState === "Running" ? "warning" :
    undefined
  );

  return (
    <div className={"has-background-" + stateColor + "-light p-4"}>
      <div className="columns is-mobile">
        <div className="column is-two-thirds p-0">
          <p>
            Run {props.run.id}
          </p>
          <p>{props.run.code.description}</p>
        </div>
        <div className="column is-one-third p-0 has-text-right">
          <p>{runState}</p>
        </div>
      </div>
      <div className="columns is-mobile">
        <div className="column is-two-thirds p-0">
          <p></p>
          <p>{formatDate(props.run.date)}</p>
        </div>
        <div className="column is-one-third p-0 has-text-right">
          <p className="tag">{props.run.code.commit_hash.slice(0,7)}</p>
        </div>
      </div>
    </div>
  );
}


export default App;
