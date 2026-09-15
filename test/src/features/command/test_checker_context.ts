import { EvidenceChecker, EvidenceConfigLoader } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Gives every invocation of a reusable checker its own execution context.
 *
 * A TypeScript function acknowledges one Markdown requirement. Reusing the
 * checker must preserve each invocation's captured policy while loading current
 * source, rather than sharing mutable plans or retaining earlier coverage.
 *
 * 1. Load the passing plan and make a copy whose reference root is missing.
 * 2. Start the valid evaluation, clear its caller-owned plan, and concurrently
 *    evaluate the invalid copy. Verify that:
 *
 *    - The captured valid plan still passes with one covered reference unit.
 *    - The missing-root plan is incomplete without affecting the valid result.
 * 3. Remove the function's annotation and call `check` on the same facade:
 *
 *    - The fresh report fails with one missing unit.
 *    - The earlier report remains successful and independently owned.
 */
export async function test_checker_context(): Promise<void> {
  await EvidenceTestFileSystem.experiment(
    join(__dirname, `checker context ${randomUUID()}`),
    {
      "evidence.config.ts": dedent`
        export default {
          claims: [{
            type: "typescript", files: ["implementation.ts"], symbol: "function",
            reference: { type: "markdown", files: ["spec.md"], symbol: "h2" },
          }],
        };
      `,
      "spec.md": "## Feature {#feature}\n\nRequired behavior.\n",
      "implementation.ts": dedent`
        /** @evidence spec.md#feature Implements the required behavior. */
        export function implementation(): void {}
      `,
    },
    async (directory) => {
      const configFile = join(directory, "evidence.config.ts");
      const checker = new EvidenceChecker(configFile);
      const plan = await EvidenceConfigLoader.plan(configFile);
      const invalid = structuredClone(plan);
      const invalidClaim = invalid.claims[0];
      const reference =
        invalidClaim === undefined ? undefined : invalidClaim.references[0];
      if (reference === undefined)
        throw new Error("Missing reference fixture.");
      reference.population.root = "absent";

      // An incomplete concurrent invocation must not contaminate a valid one.
      const pending = checker.evaluate(plan);
      plan.claims.length = 0;
      const [passing, incomplete] = await Promise.all([
        pending,
        checker.evaluate(invalid),
      ]);
      TestValidator.equals("captured plan", passing.report.success, true);
      TestValidator.equals(
        "independent incomplete plan",
        incomplete.report.status,
        "incomplete",
      );
      TestValidator.equals(
        "reference denominator",
        passing.report.counts.coveredUnits,
        1,
      );

      // The same facade reloads current sources instead of reusing prior coverage.
      await EvidenceTestFileSystem.save(directory, {
        "implementation.ts": "export function implementation(): void {}\n",
      });
      const failing = await checker.check();
      TestValidator.equals("fresh uncovered run", failing.success, false);
      TestValidator.equals(
        "fresh missing unit",
        failing.counts.missingUnits,
        1,
      );
      TestValidator.equals(
        "previous result retained",
        passing.report.success,
        true,
      );
    },
  );
}
