import type { IEvidenceDocumentation } from "../../../packages/evidence/src/structures/IEvidenceDocumentation";
import type { IEvidenceHost } from "../../../packages/evidence/src/structures/IEvidenceHost";

/** A comment embedded in source, its known host, and the mapped normalized body. */
export interface ITestDocumentation {
  content: string;
  host: IEvidenceHost;
  documentation: IEvidenceDocumentation;
}
