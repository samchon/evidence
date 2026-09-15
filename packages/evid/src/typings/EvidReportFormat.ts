/** Report encodings supported by the check command.
 *
 * `text` is the diagnostic-oriented terminal presentation. `json` preserves the
 * report structure for automation, including fields a human formatter may omit
 * or rearrange.
 */
export type EvidReportFormat = "text" | "json";
