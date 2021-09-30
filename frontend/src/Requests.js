import {Branch, Code, Commit, Run, mkRun, LaunchNotInitiated, LaunchInitiated, 
  LaunchSuccessful, LaunchFailed} from './Core';
import {BACKEND_HOST, BACKEND_PORT, DEFAULT_JOB_DIR, DEFAULT_OUTPUT_DIR, 
  DEFAULT_SCRIPT, JOB_REPO_API} from './Constants';


export async function fetchBranches() {
  const req = new URL(JOB_REPO_API + "/branches")
  const errorMsg =  "Could not fetch branches.";
  return (fetch(req)
    .catch(throwNetworkError(req, errorMsg))
    .then(jsonOrThrowHttpError(req, errorMsg))
    .then(json => json.map(branch => new Branch(branch.name))));
}


export async function fetchCommits(branch) {
    let req = new URL(JOB_REPO_API + "/commits");
    req.searchParams.set("sha", branch);
    const errorMsg = "Could not fetch commits.";
    return (fetch(req)
      .catch(throwNetworkError(req, errorMsg))
      .then(jsonOrThrowHttpError(req, errorMsg))
      .then(json => json.map(commit => {
        return new Commit(commit.sha, commit.commit.author.date, commit.commit.author.name,
          commit.commit.message)
      })));
}


export async function fetchAllRuns(branch) {
  let req = new URL("http://" + BACKEND_HOST + ":" + BACKEND_PORT + "/all_runs");
  const errorMsg = "Could not fetch run list.";
  return (fetch(req)
    .catch(throwNetworkError(req,errorMsg))
    .then(jsonOrThrowHttpError(req, errorMsg))
    .then(json => json.map(run => {
      return new Run(
        run.id,
        new Code(
          run.code.commit_hash,
          run.code.branch,
          run.code.description,
        ),
        run.timestamp,
        run.job_dir,
        run.output_dir,
        run.script,
        run.state
      )
    }))
  );
}


export async function launchRun(run) {
  let req = new URL("http://" + BACKEND_HOST + ":" + BACKEND_PORT + "/launch/" + run.code.commit_hash);
  req.searchParams.set("branch", run.code.branch.name)
  req.searchParams.set("description", run.code.description)
  req.searchParams.set("timestamp", run.date)
  req.searchParams.set("job_dir", run.job_dir)
  req.searchParams.set("output_dir", run.output_dir)
  req.searchParams.set("script", run.script)
  const errorMsg = "Could not launch run.";

  return (fetch(req)
    .catch(throwNetworkError(req, errorMsg))
    .then(jsonOrThrowHttpError(req, errorMsg))
  );
}


export async function fetchNewLogs(runId, lastLogDate) {
  let req = new URL("http://" + BACKEND_HOST + ":" + BACKEND_PORT + "/logs/" + runId);
  req.searchParams.set("from_time", lastLogDate.toISOString());
  const errorMsg = "Could not fetch logs.";

  return (fetch(req)
    .catch(throwNetworkError(req, errorMsg))
    .then(jsonOrThrowHttpError(req, errorMsg))
    .then(logs => {
      for (let context in logs) {
        for (let log of logs[context]) {
          log.timestamp = new Date(log.timestamp);
        }
      }
      return logs;
    })
  );
}


export async function fetchRunOutput(runId) {
  let req = new URL("http://" + BACKEND_HOST + ":" + BACKEND_PORT + "/output/" + runId);
  const errorMsg = "Could not fetch run output.";

  return (fetch(req)
    .catch(throwNetworkError(req, errorMsg))
    .then(jsonOrThrowHttpError(req, errorMsg))
    .then(json => json.text)
  );
}


export async function fetchRunResults(runId) {
  let req = new URL("http://" + BACKEND_HOST + ":" + BACKEND_PORT + "/posterior_sample/" + runId);
  const errorMsg = "Could not fetch posterior sample.";

  return (fetch(req)
    .catch(throwNetworkError(req, errorMsg))
    .then(jsonOrThrowHttpError(req, errorMsg))
  );
}


class NetworkError extends Error {
  constructor(url, message, cause) {
    super(message + " Unable to reach '" + url.toString() + "' Cause: " + cause.toString())
    this.name = "NetworkError"
  }
}


const throwNetworkError = (url, msg) => cause => {
  if (cause instanceof TypeError) {
    throw new NetworkError(url, msg, cause);
  } else throw cause;
};


class HttpError extends Error {
  constructor(url, httpResponse, message) {
    super(message + " Requested resource: '" + url + "' Status " + httpResponse.status + " Headers: " +
      JSON.stringify(Array.from(httpResponse.headers)));
    this.name = "HttpError";
  }
};


const jsonOrThrowHttpError = (url, msg) => response => {
  if (response.ok) {
    return response.json()
  } else {
    throw new HttpError(url, response, msg)
  }
};
