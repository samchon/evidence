import type { IEvidenceInspectReport } from "../structures/IEvidenceInspectReport";
import type { IEvidenceLanguagesReport } from "../structures/IEvidenceLanguagesReport";
import type { IEvidenceListReport } from "../structures/IEvidenceListReport";

/**
 * Structured result returned by an inspection-oriented command.
 *
 * Query commands share output rendering but answer different questions: listing
 * discovered units, inspecting a target, or reporting available languages. This
 * union keeps the renderer generic while each command preserves its own
 * schema.
 */
export type EvidenceQueryReport =
  IEvidenceInspectReport | IEvidenceLanguagesReport | IEvidenceListReport;
