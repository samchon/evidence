import type { IEvidenceSourceRange } from "../../structures/IEvidenceSourceRange";

/** Nonselectable enum semantics retained as schema fingerprint dependencies. */
export interface IDbmlEnum {
  /** Qualified literal enum identity. */
  identity: string[];

  /** Whitespace-independent enum tokens excluding documentation. */
  content: string;

  /** Original enum declaration range. */
  range: IEvidenceSourceRange;
}
