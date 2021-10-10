import {useReducer, useEffect, memo} from 'react';
import './App.css';
import {UiState, HomeView, newHomeView, RunView, mkRun, LaunchNotInitiated, 
  LaunchInitiated, LaunchSuccessful, LaunchFailed, addLogs, getLastLogTimestamp, 
  runStateColor} from './Core';
import {fetchBranches, fetchCommits, fetchAllRuns, launchRun, fetchNewLogs,
  fetchRun, fetchRunOutput, fetchRunResults} from './Requests';
import {RUN_STATE_UPDATE_INTERVAL, RUN_OUTPUT_UPDATE_INTERVAL,
  RUN_RESULTS_UPDATE_INTERVAL, RUN_LOGS_UPDATE_INTERVAL} from './Constants';
import {formatDate, shortDate, set_, equals, dateFromUnixEpoch} from './Util';
import embed from 'vega-embed';

function reducer(state, action) {
  console.log("ACTION " + JSON.stringify(action.type));
  switch(action.type) {
    case "runView/close":
      return set_("view")(state.view.close())(state);

    case "runView.run/set":
      if (!equals(state.view.run, action.value)) {
        return set_("view", "run")(action.value)(state);
      } else {
        return state;
      }

    case "homeView.runListView.notification/set":
      if (!equals(action.value, state.view.runListView.notification)) {
        return set_("view", "runListView", "notification")(action.value)(state);
      } else {
        return state
      }

    case "homeView.runListView.runList/addRun":
      return set_("view", "runListView", "runList")([action.value, ...state.view.runListView.runList])(state);

    case "homeView.runListView.runList/set":
      if (!equals(state.view.runListView.runList, action.value)) {
        return set_("view", "runListView", "runList")(action.value)(state);
      } else {
        return state
      }

    case "runView.runLogsView.logs/set":
      let newLogs = action.value;
      if (Object.keys(newLogs).length !== 0) {
        state = set_("view", "runLogsView", "notification")(undefined)(state);
        const l = addLogs(state.view.runLogsView.logs, newLogs);
        state = set_("view", "runLogsView", "logs")(l)(state);
      }
      return state;

    case  "runView.runLogsView.notification/set":
      if (!equals(action.value, state.view.runLogsView.notification)) {
        return set_("view", "runLogsView", "notification")(action.value)(state);
      } else {
        return state;
      }

    case  "runView.runOutputView.notification/set":
      if (!equals("Waiting for some output…", state.view.runOutputView.notification)) {
        return set_("view", "runOutputView", "notification")(action.value)(state);
      } else {
        return state;
      }

    case "runView.runOutputView.output/set":
      const output = state.view.runOutputView.output;
      const newOutput = action.value;
      if (!equals(output, newOutput)) {
        state = set_("view", "runOutputView", "notification")(undefined)(state);
        if (newOutput) {
          state = set_("view", "runOutputView", "output")(newOutput)(state);
        }
      }
      return state;

    case "runView.runResultsView.notification/set":
      if (!equals(action.value, state.view.runResultsView.notification)) {
        return set_("view", "runResultsView", "notification")(action.value)(state);
      } else {
        return state;
      }

    case "runView.runResultsView.posteriorSample/set":
      if (!equals(action.value, state.view.runResultsView.posteriorSample)) {
        if (action.value.length !== 0) {
          return set_("view", "runResultsView", "notification")(undefined)(
            set_("view", "runResultsView", "posteriorSample")(action.value)(state)
          );
        } else if (!equals(state.view.runResultsView.notification, "Waiting for some results…")) {
          return set_("view", "runResultsView", "notification")("Waiting for some results…")(state);
        } else {
          return state;
        }
      }

    case "homeView/openRunView":
      return set_("view")(state.openRunView(action.value))(state);

    case "homeView.runSetupTool/open":
      return set_("view", "runSetupTool", "isOpen")(true)(state);

    case "homeView.runSetupTool/close":
      return set_("view", "runSetupTool", "isOpen")(false)(state);

    case "homeView.runSetupTool.branch/set":
      return set_("view", "runSetupTool", "branch")(action.value)(state);

    case "homeView.runSetupTool.branchList/set":
      return set_("view", "runSetupTool", "branchList")(action.value)(state);

    case "homeView.runSetupTool.commit/set":
      return set_("view", "runSetupTool", "commit")(action.value)(state);

    case "homeView.runSetupTool.commitList/set":
      if(!equals(action.value, state.view.runSetupTool.commitList)) {
        return set_("view", "runSetupTool", "commitList")(action.value)(state);
      } else {
        return state;
      }

    case "homeView.runSetupTool.jobDir/set":
      return set_("view", "runSetupTool", "jobDir")(action.value)(state);

    case "homeView.runSetupTool.notification/set":
      const err = action.value;
      if (!equals(err, state.view.runSetupTool.notification)) {
        return set_("view", "runSetupTool", "notification")(err)(state);
      } else {
        return state;
      }

    case "homeView.runSetupTool.outputDir/set":
      return set_("view", "runSetupTool", "outputDir")(action.value)(state);

    case "homeView.runSetupTool.script/set":
      return set_("view", "runSetupTool", "script")(action.value)(state);

    default:
      throw Error("Unknown action " + JSON.stringify(action));
  }
}

function App(props) {
  const [state, dispatch] = useReducer(reducer, new UiState(newHomeView()));

  console.log("Rendering App");

  let mainView;
  if (state.view instanceof RunView) {
    mainView = (
      <RunViewComp
        runView={state.view}
        dispatch={dispatch}
      />
    );
  } else if (state.view instanceof HomeView) {
     mainView = (
       <HomeViewComp
         homeView={state.view}
         dispatch={dispatch}
       />
     );
  } else {
    throw Error("Unknown view " + JSON.stringify(state.view));
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


const RunViewComp = memo((props) => {
   const dispatch = props.dispatch;

   useEffect(() => {
     const fetch_ = () => {
       (fetchRun(props.runView.run.id)
         .then(newRun => {
           props.dispatch({type: "runView.run/set", value: newRun});
         })
       );
     }

     if (props.runView.run.isRunning()) {
       fetch_();
       let timer = setInterval(fetch_, RUN_STATE_UPDATE_INTERVAL);
       return () => {
         clearInterval(timer)
       };
     }
   });

  return (
    <div>
      <button 
        className="block button"
        onClick={() => props.dispatch({type: "runView/close"})}
      >
        Back
      </button>

      <div className="block">
        <RunCard run={props.runView.run}/>
      </div>

      <RunResultsViewComp
        run={props.runView.run}
        runResultsView={props.runView.runResultsView}
        dispatch={props.dispatch}
      />
      <RunOutputViewComp
        run={props.runView.run}
        runOutputView={props.runView.runOutputView}
        dispatch={props.dispatch}
      />
      <RunLogsViewComp
        runLogsView={props.runView.runLogsView}
        run={props.runView.run}
        dispatch={props.dispatch}
      />
    </div>
  );
});


const RunResultsViewComp = memo((props) => {
  const results = props.runResultsView.posteriorSample;
  const run = props.run;
  const notification = props.runResultsView.notification;
  const visu = props.runResultsView.vegaSpec;
  const dispatch = props.dispatch;

  useEffect(() => {
    let isMounted = true;
    const fetch_ = () => {
      (fetchRunResults(run.id)
        .then(newResults => {
          if(isMounted) {
            dispatch({type: "runView.runResultsView.posteriorSample/set", value: newResults});
          }
        })
        .catch(err => {
            dispatch({type: "runView.runResults.notification/set", value: "Waiting for some results…"});
        })
      );
    };

    if (run.isRunning() || results === undefined) {
      fetch_();
      let timer = setInterval(fetch_, RUN_RESULTS_UPDATE_INTERVAL)
      return () => {
        isMounted = false;
        clearInterval(timer)
      };
    }
  });

  useEffect(() => {
    if (results) {
      embed('#vis', visu(results));
    }
  });

  return (
    <div className="">
      <h3 className="subtitle">Run results</h3>
      <NotificationArea msg={notification} />
      <div id="vis"></div>
    </div>
  );
});


const RunOutputViewComp = memo((props) => {
  const run = props.run;
  const output = props.runOutputView.output;
  const notification = props.runOutputView.notification;
  const dispatch = props.dispatch;

  useEffect(() => {
    const fetch_ = () => {
      (fetchRunOutput(run.id)
        .then(newOutput => {
          dispatch({type: "runView.runOutputView.output/set", value: newOutput});
        })
        .catch(err => {
          dispatch({type: "runView.runOutputView.notification/set", value: "Waiting for some output…"})
        })
      );
    }


    if (run.isRunning() || output === undefined) {
      fetch_();
      let timer = setInterval(fetch_, RUN_OUTPUT_UPDATE_INTERVAL);
      return () => clearInterval(timer);
    }
  });

  return (
    <div className="columns">
    <div className="column is-centered is-full">
      <h2 className="subtitle">Run output</h2>
      <NotificationArea msg={notification} />
      <div className="break-words is-family-monospace">{output}</div>
    </div>
    </div>
  );
});


const RunLogsViewComp = memo((props) => {
  const logs = props.runLogsView.logs;
  const run = props.run;
  const notification = props.runLogsView.notification;
  const dispatch = props.dispatch;

  useEffect(() => {
    let lastLogTimestamp = getLastLogTimestamp(logs);
    const fetch_ = () => (
      fetchNewLogs(run.id, lastLogTimestamp)
      .then(newLogs => {
        dispatch({type: "runView.runLogsView.logs/set", value: newLogs});
        const newLastLogTimestamp = getLastLogTimestamp(newLogs);
        lastLogTimestamp = Math.max(lastLogTimestamp, newLastLogTimestamp);
      })
      .catch(err => {
        dispatch({type: "runView.runLogsView.notification/set", value: err});
      })
    );

    if (run.isRunning() || logs === undefined) {
      fetch_();
      let timer = setInterval(fetch_, RUN_LOGS_UPDATE_INTERVAL);
      return () => clearInterval(timer);
    }
  });

  let logElements = [];
  for (let context in logs) {
    for (let log of logs[context]) {
      logElements.push(
        <div className="columns has-background-light mb-4">
          <div className="column is-2">
            <p className="tag">{context}</p>
            <p className="">{shortDate(dateFromUnixEpoch(log.timestamp))}</p>
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
      <NotificationArea msg={notification} />
      {logElements}
    </div>
  );
});


const HomeViewComp = memo((props) => {
  return (
    <div>
      <NewRunSetupToolComp
        runSetupTool={props.homeView.runSetupTool}
        dispatch={props.dispatch}
      />
      <p className="block mt-5">Or choose a run from the list below to see the logs and results:</p>
      <RunListViewComp
        runListView={props.homeView.runListView}
        dispatch={props.dispatch}
      />
    </div>
  );
});


const NewRunSetupToolComp = memo((props) => {
  let upperPanel;
  if (!props.runSetupTool.isOpen) {
    upperPanel = (
      <StartNewRunButton dispatch={props.dispatch} />
    );
  } else {
    upperPanel = (
      <div className="box">
        <div className="columns is-centered">
          <div className="column">
            <CodeSelector
              branch={props.runSetupTool.branch}
              commit={props.runSetupTool.commit}
              branchList={props.runSetupTool.branchList}
              commitList={props.runSetupTool.commitList}
              notification={props.runSetupTool.notification}
              dispatch={props.dispatch}
            />
            <RunConfigComp
              commit={props.runSetupTool.commit}
              jobDir={props.runSetupTool.jobDir}
              outputDir={props.runSetupTool.outputDir}
              script={props.runSetupTool.script}
              dispatch={props.dispatch}
            />
            <ConfirmStartNewRunButton
              commit={props.runSetupTool.commit}
              branch={props.runSetupTool.branch}
              jobDir={props.runSetupTool.jobDir}
              outputDir={props.runSetupTool.outputDir}
              script={props.runSetupTool.script}
              dispatch={props.dispatch}
            />
          </div>
        </div>
      </div>
    );
  }


  return (
    <div>
      {upperPanel}
      <NotificationArea msg={props.notification} />
    </div>
  );
});


const StartNewRunButton = memo((props) => {
    return (
      <div className="columns is-centered">
        <div className="column is-narrow">
          <a
            className="box has-background-info-light"
            onClick={() => props.dispatch({type: "homeView.runSetupTool/open"})}
          >
            Start a new run
          </a>
        </div>
      </div>
    );
});


const RunConfigComp = memo((props) => {
  if (props.commit) {
    return (
      <div className="columns is-centered">
        <div className="column">
          <h3 className="subtitle">Run configuration:</h3>
          <p>
            <label>
              Job directory:
              <input type="text"
                onChange={e => 
                  props.dispatch({type: "homeView.runSetupTool.jobDir/set", value: e.target.value})}
                value={props.jobDir}
              />
            </label>
          </p>
          <p>
            <label>
              Output directory:
              <input type="text"
                onChange={e => 
                  props.dispatch({type: "homeView.runSetupTool.outputDir/set", value: e.target.value})}
                value={props.outputDir}
              />
            </label>
          </p>
          <p>
            <label>
              Script file:
              <input type="text"
                onChange={e => 
                  props.dispatch({type: "homeView.runSetupTool.script/set", value: e.target.value})}
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
});


const ConfirmStartNewRunButton = memo((props) => {
  const confirmLaunchRun = () => {
    props.dispatch({type: "homeView.runListView.notification/set", value: new LaunchInitiated()});
    (launchRun(mkRun(props.commit, props.branch, props.jobDir, props.outputDir,
      props.script))
      .then(run => {
        props.dispatch({type: "homeView.runListView.notification/set", value: new LaunchSuccessful(run)});
        props.dispatch({type: "homeView.runListView.runList/addRun", value: run});
        props.dispatch({type: "homeView.runSetupTool/close"});
      })
      .catch(err => {
        props.dispatch({type: "homeView.runListView.notification/set", value: new LaunchFailed(err)});
      })
    );
  }

  if (props.commit) {
    return (
      <div>
        <button
          className="button is-primary"
          type="button"
          disabled={false}
          onClick={confirmLaunchRun}
        >
          Start run.
        </button>
      </div>
    );
  } else {
    return (<div />);
  }
});


const CodeSelector = memo((props) => {
  if (props.branch && props.commit) {
    return (
      <SelectedCommitView
        branch={props.branch}
        commit={props.commit}
        unsetCommit={() => 
          props.dispatch({type: "homeView.runSetupTool.commit/set", value: undefined})
        }
      />
    );
  } else {
    return (
      <div className="columns">
        <div className="column is-one-quarter">
          <BranchMenu
            branch={props.branch}
            notification={props.notification}
            branchList={props.branchList}
            dispatch={props.dispatch}
          />
        </div>
        <div className="column">
          <CommitMenu
            branch={props.branch}
            commit={props.commit}
            commitList={props.commitList}
            notification={props.notification}
            dispatch={props.dispatch}
          />
        </div>
      </div>
    );
  }
});


const BranchItem = memo((props) => {
  return (
    <li>
      <a
        className={(props.branch?.name === props.name ? " is-active" : "")}
        onClick={props.onClick}
      >
        {props.name}
      </a>
    </li>
  );
});


const SelectedCommitView = memo((props) => {
  const c = props.commit;

  return (
    <div className="columns is-centered">
    <div className="column">
      <div className="box has-background-info-light">
        <a className="has-text-dark" onClick={props.unsetCommit}>
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
});


const BranchMenu = memo((props) => {
  useEffect(() => {
    let isMounted = true;

    if (props.branchList === undefined) {
      (fetchBranches()
        .then(bs => {
          if (isMounted) {
            props.dispatch({type: "homeView.runSetupTool.branchList/set", value: bs});
          }
        })
        .catch(err => {
          if (!equals(err, props.notification)) {
            props.dispatch({type: "homeView.runSetupTool.notification/set", value: err});
          }
        })
      );
    }

    return () => { isMounted = false };
  });


  return (
    <div className="menu">
      <p className="menu-label">Branches:</p>
      <NotificationArea msg={props.notification} />
      <ul className="menu-list">{
        props.branchList?.map(b => (
            <BranchItem
              key={b.name}
              name = {b.name}
              branch = {props.branch}
              onClick={() => 
                props.dispatch({type: "homeView.runSetupTool.branch/set", value: b})
              }
            />
          ))
      }</ul>
    </div>
  );
});


const NotificationArea = memo((props) => {
  const notification = props.msg;

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


  if (message) {
    console.log(message);
    return (
      <div className={"notification break-words " + messageClass}>
        {message}
      </div>
    );
  } else {
    return (<></>);
  }
});


const CommitMenu = memo((props) => {
  let notifMsg;
  if (!props.notification) {
    if (props.branch) {
      notifMsg = undefined;
    } else {
      notifMsg = "Please select a branch";
    }
  } else {
    notifMsg = props.notification;
  }

  useEffect(() => {
    let isMounted = true;
    if (props.branch && props.commitList === undefined) {
      (fetchCommits(props.branch.name)
        .then(cs => {
          if (isMounted) {
            props.dispatch({type: "homeView.runSetupTool.commitList/set", value: cs});
          }
        })
        .catch(err => {
          props.dispatch({type: "homeView.runSetupTool.notification/set", value: err})
        })
      );
    }
    return () => { isMounted = false };
  });

  return (
    <div className="menu">
      <p className="menu-label">Commits:</p>
      <NotificationArea msg={notifMsg} />
      <ul className="menu-list">{
        props.commitList?.map(c => (
          <CommitItem
            key={c.hash}
            commit={c}
            onClick={() => 
              props.dispatch({type: "homeView.runSetupTool.commit/set", value: c})
            }
          />
        ))
      }</ul>
    </div>
  );
});


const CommitItem = memo((props) => {
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
});


const RunListViewComp = memo((props) => {
  useEffect(() => {
    let isMounted = true;

    const fetch_ = () => (fetchAllRuns()
      .then(rs => {
        if (isMounted) {
          props.dispatch({type: "homeView.runListView.runList/set", value: rs});
        }
      })
      .catch(err => {
        props.dispatch({type: "homeView.runListView.notification/set", value: err});
      })
    );

    fetch_();
    let timer = setInterval(fetch_, RUN_STATE_UPDATE_INTERVAL);
    return () => {
      isMounted = false;
      clearInterval(timer);
    }
  });

  return (
    <div className="columns">
      <div className="column">
        <NotificationArea msg={props.runListView.notification} />
        <div className="menu">
          <ul className="menu-list">{
            props.runListView.runList?.map(r => (
                <li key={r.id} className="mb-2 mt-0">
                  <a onClick={() =>
                    props.dispatch({type: "homeView/openRunView", value: r})
                    }
                    className="p-0 m-0"
                  >
                    <RunCard run={r} />
                  </a>
                </li>
              ))
          }</ul>
        </div>
      </div>
    </div>
  );
});


const RunCard = memo((props) => {
  const run = props.run;

  const stateColor = runStateColor(run.state);

  return (
    <div className={"has-background-" + stateColor + "-light p-4"}>
      <div className="columns is-mobile">
        <div className="column is-two-thirds p-0">
          <p>
            Run {run.id}
          </p>
          <p>{run.code.description}</p>
        </div>
        <div className="column is-one-third p-0 has-text-right">
          <p>{run.state}</p>
        </div>
      </div>
      <div className="columns is-mobile">
        <div className="column is-two-thirds p-0">
          <p></p>
          <p>{formatDate(run.date)}</p>
        </div>
        <div className="column is-one-third p-0 has-text-right">
          <p className="tag">{run.code.commitHash.slice(0,7)}</p>
        </div>
      </div>
    </div>
  );
});


export default App;
