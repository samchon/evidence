import type { EvidenceProgrammingSymbol } from "../typings/EvidenceProgrammingSymbol";

/**
 * Requires documentation comments on selected public programming declarations.
 * Checks presence so declarations can host evidence; it does not judge the prose.
 */
export interface IEvidenceDocumentedConfig {
  /**
   * Symbol kinds requiring documentation; accepts one kind or a nonempty array.
   *
   * @default ["type", "function", "property"]
   */
  symbol?: EvidenceProgrammingSymbol | EvidenceProgrammingSymbol[];
}
