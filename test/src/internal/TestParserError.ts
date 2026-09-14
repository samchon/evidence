import { TestValidator } from "@nestia/e2e";

import { EvidenceParserError } from "../../../packages/evidence/src/parsers/EvidenceParserError";
import type { EvidenceParserErrorCode } from "../../../packages/evidence/src/typings/EvidenceParserErrorCode";

/** Requires the precise analysis failure, rather than accepting an unrelated exception. */
export namespace TestParserError {
  export async function expect(
    code: EvidenceParserErrorCode,
    closure: () => unknown,
  ): Promise<EvidenceParserError> {
    try {
      await closure();
    } catch (error) {
      if (!(error instanceof EvidenceParserError)) throw error;
      TestValidator.equals("parser diagnostic", error.code, code);
      return error;
    }
    throw new Error(`Expected parser failure: ${code}`);
  }
}
