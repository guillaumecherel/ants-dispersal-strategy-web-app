import dotenvconfig from 'dotenv/config';

// for (let key in process.env) {
//   console.log("Env " + key + "=" + process.env[key]);
// }

export const BACKEND_BASE_URL = new URL(process.env.REACT_APP_BACKEND_BASE_URL);
export const DEFAULT_JOB_DIR = process.env.REACT_APP_DEFAULT_JOB_DIR;
export const DEFAULT_OUTPUT_DIR = process.env.REACT_APP_DEFAULT_OUTPUT_DIR;
export const DEFAULT_SCRIPT = process.env.REACT_APP_DEFAULT_SCRIPT;
export const RUN_STATE_UPDATE_INTERVAL = process.env.REACT_APP_RUN_STATE_UPDATE_INTERVAL;
export const RUN_LOGS_UPDATE_INTERVAL = process.env.REACT_APP_RUN_LOGS_UPDATE_INTERVAL;
export const RUN_OUTPUT_UPDATE_INTERVAL = process.env.REACT_APP_RUN_OUTPUT_UPDATE_INTERVAL;
export const RUN_RESULTS_UPDATE_INTERVAL = process.env.REACT_APP_RUN_RESULTS_UPDATE_INTERVAL;
export const JOB_REPO_API = process.env.REACT_APP_JOB_REPO_API;
