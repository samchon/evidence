/** One stable configuration or operational failure observed by a watcher. */
export interface IEvidenceWatchFailureCycle {
  schemaVersion: 1;
  command: "check";
  watch: true;
  cycle: number;
  status: "failed";
  success: false;
  exitCode: 2;
  configFile: string;
  message: string;
  repair: string;
}
