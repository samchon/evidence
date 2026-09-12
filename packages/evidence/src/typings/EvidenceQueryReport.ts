import type { IEvidenceInspectReport } from "../structures/IEvidenceInspectReport";
import type { IEvidenceLanguagesReport } from "../structures/IEvidenceLanguagesReport";
import type { IEvidenceListReport } from "../structures/IEvidenceListReport";

/** Machine-readable reports rendered as text or JSON by query commands. */
export type EvidenceQueryReport =
  IEvidenceInspectReport | IEvidenceLanguagesReport | IEvidenceListReport;
