import { EvidParserError } from "evid";
import type { EvidParserErrorCode } from "evid";
import { TestValidator } from "@nestia/e2e";

/**
 * Requires the precise analysis failure, rather than accepting an unrelated
 * exception.
 */
export namespace EvidTestParserError {
  export async function expect(
    code: EvidParserErrorCode,
    closure: () => unknown,
  ): Promise<EvidParserError> {
    try {
      await closure();
    } catch (error) {
      if (!(error instanceof EvidParserError)) throw error;
      TestValidator.equals("parser diagnostic", error.code, code);
      return error;
    }
    throw new Error(`Expected parser failure: ${code}`);
  }
}
