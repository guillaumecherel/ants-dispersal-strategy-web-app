export function Branch(name) {
  this.name = name;
}

export function Commit(hash, date, author, message) {
  this.hash = hash;
  this.date = date;
  this.author = author;
  this.message = message;
}

export function Code(commit_hash, branch, description) {
  this.commit_hash = commit_hash;
  this.branch = branch;
  this.description = description;
}

export function Run(id, code, date, job_dir, output_dir, script, state) {
    this.id = id;
    this.code = code;
    this.date = date;
    this.job_dir = job_dir;
    this.output_dir = output_dir;
    this.script = script;
    this.state = state;
}

export const mkRun = (commit, branch, job_dir, output_dir, script) => new Run(
  undefined,
  new Code(
    commit.hash,
    branch,
    commit.message),
  (new Date()).toISOString(),
  job_dir,
  output_dir,
  script);

export function LaunchNotInitiated() {};
export function LaunchInitiated() {};
export function LaunchSuccessful(runId) {
  this.runId = runId
};
export function LaunchFailed(error) {
  this.error = error
};
