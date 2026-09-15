import type { IEvidenceDocumentation, IEvidenceHost } from "evidence";

/** A comment embedded in source, its known host, and the mapped normalized body. */
export interface IEvidenceTestDocumentation {
  content: string;
  host: IEvidenceHost;
  documentation: IEvidenceDocumentation;
}
