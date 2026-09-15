import type { IEvidDocumentation, IEvidHost } from "evid";

/** A comment embedded in source, its known host, and the mapped normalized body. */
export interface ITestDocumentation {
  content: string;
  host: IEvidHost;
  documentation: IEvidDocumentation;
}
