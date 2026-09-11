/** One ordered include or exclude pattern, split at normalized separators. */
export interface IFileGlobPattern {
  segments: string[];
  exclude: boolean;
}
