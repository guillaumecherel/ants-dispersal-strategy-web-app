import {DEFAULT_JOB_DIR, DEFAULT_OUTPUT_DIR, DEFAULT_SCRIPT} from './Constants';
import {visu} from './Visu';

export function UiState(view) {
  this.view = view;

  this.openRunView = run => new RunView(
    run,
    new RunResultsView(undefined, visu, "Loading…"),
    new OutputView(undefined, "Loading…"),
    new LogsView(undefined, "Loading…"),
    undefined);
}

export function HomeView(runSetupTool, runListView) {
  this.runSetupTool = runSetupTool;
  this.runListView = runListView;
}

export const newHomeView = () => (
  new HomeView(
    new RunSetupToolView(false, undefined, undefined, undefined, undefined, DEFAULT_JOB_DIR, DEFAULT_OUTPUT_DIR, DEFAULT_SCRIPT),
    new RunListView([], undefined))
);

export function RunListView(runList, notification) {
  this.runList = runList;
  this.notification = notification;

  this.addRun = x => this.runList.slice().unshift(x);
}

export function RunSetupToolView(isOpen, branch, commit, branchList, commitList,
  jobDir, outputDir, script, notification) {
  this.isOpen = isOpen;
  this.branch = branch;
  this.commit = commit;
  this.branchList = branchList;
  this.commitList = commitList;
  this.jobDir = jobDir;
  this.outputDir = outputDir;
  this.script = script;
  this.notification = notification;
}

export function RunView(run, runResultsView, runOutputView, runLogsView, notification) {
  this.run = run;
  this.runResultsView = runResultsView;
  this.runOutputView = runOutputView;
  this.runLogsView = runLogsView;
  this.notification = notification;

  this.close = () => newHomeView();
}

export function RunResultsView(posteriorSample, vegaSpec, notification) {
  this.posteriorSample = posteriorSample;
  this.vegaSpec = vegaSpec;
  this.notification = notification;
}

export function OutputView(output, notification) {
  this.output = output;
  this.notification = notification;
}

export function LogsView(logs, notification) {
  this.logs = logs;
  this.notification = notification;
}

export function Branch(name) {
  this.name = name;
}

export function Commit(hash, timestamp, author, message) {
  this.hash = hash;
  this.timestamp = timestamp;
  this.author = author;
  this.message = message;
}

export function Code(commitHash, branch, description) {
  this.commitHash = commitHash;
  this.branch = branch;
  this.description = description;
}

export function Run(id, code, timestamp, jobDir, outputDir, script, state) {
    this.id = id;
    this.code = code;
    this.timestamp = timestamp;
    this.jobDir = jobDir;
    this.outputDir = outputDir;
    this.script = script;
    this.state = state;

    this.isRunning = () => this.state === "Running";
}

export const mkRun = (commit, branch, jobDir, outputDir, script) => new Run(
  undefined,
  new Code(
    commit.hash,
    branch,
    commit.message),
  Date.now(),
  jobDir,
  outputDir,
  script);

export function LaunchNotInitiated() {};
export function LaunchInitiated() {};
export function LaunchSuccessful(run) {
  this.run = run;
};
export function LaunchFailed(error) {
  this.error = error;
};

export const addLogs = (logs1, logs2) => {
    let result = {};

    for (let context in logs1) {
      result[context] = logs1[context];
    }

    for (let context in logs2) {
      if (context in result) {
        result[context] = [...result[context], ...logs2[context]];
      } else {
        result[context] = logs2[context];
      }
    }

    return result;
}

export const getLastLogTimestamp = (logs) => {
  let result = 0;

  for (let context in logs) {
    for (let log of logs[context]) {
      result = log.timestamp > result ? log.timestamp : result;
    }
  }

  return result
}

export const runStateLabel = intState => (
  intState === 1 ? "Running" :
  intState === 2 ? "Failed" :
  intState === 3 ? "Finished" : undefined
);

export const runStateColor = label => (
  label === "Finished" ? "success":
  label === "Failed" ? "danger":
  label === "Running" ? "warning" :
  undefined
);
