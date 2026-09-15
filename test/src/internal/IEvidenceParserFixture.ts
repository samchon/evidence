import type { IEvidenceParserInput } from "evidence";

/** A real declaration and its expected capture under one shipped syntax variant. */
export interface IEvidenceParserFixture extends IEvidenceParserInput {
  grammar: string;
  query: string;
  name: string;
}
