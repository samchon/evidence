import { EvidenceChecker, EvidenceConfigLoader } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/**
 * Gives every invocation of a reusable checker its own execution context.
 *
 * Concurrent plans use different reference roots, and later checks observe source changes without carrying over prior coverage.
 */
export async function test_checker_context(): Promise<void> {
  await TestFileSystem.experiment(
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
      await TestFileSystem.save(directory, {
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
