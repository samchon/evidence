import type { IEvidInspectReport } from "../structures/IEvidInspectReport";
import type { IEvidLanguagesReport } from "../structures/IEvidLanguagesReport";
import type { IEvidListReport } from "../structures/IEvidListReport";

/** Structured result returned by an inspection-oriented command.
 *
 * Query commands share output rendering but answer different questions: listing
 * discovered units, inspecting a target, or reporting available languages. This
 * union keeps the renderer generic while each command preserves its own schema.
 */
export type EvidQueryReport =
  IEvidInspectReport | IEvidLanguagesReport | IEvidListReport;
