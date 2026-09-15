import { EvidenceParserError } from "evidence";
import type { EvidenceParserErrorCode } from "evidence";
import { TestValidator } from "@nestia/e2e";

/**
 * Requires the precise analysis failure, rather than accepting an unrelated
 * exception.
 */
export namespace EvidenceTestParserError {
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
