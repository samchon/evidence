import type { IEvidParserInput } from "evid";

/** A real declaration and its expected capture under one shipped syntax variant. */
export interface IParserFixture extends IEvidParserInput {
  grammar: string;
  query: string;
  name: string;
}
