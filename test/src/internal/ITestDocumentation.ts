import type { IEvidenceDocumentation, IEvidenceHost } from "@wrtnlabs/evidence";

/** A comment embedded in source, its known host, and the mapped normalized body. */
export interface ITestDocumentation {
  content: string;
  host: IEvidenceHost;
  documentation: IEvidenceDocumentation;
}
