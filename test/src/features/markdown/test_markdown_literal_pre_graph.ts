import { EvidChecker } from "evid";
import type {
  IEvidCheckObligation,
  IEvidCheckClaim,
  IEvidCheckReport,
  IEvidDiagnostic,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";

/**
 * Keeps uncovered requirements visible after literal rendered-tag examples.
 *
 * Markdown inventory loss can turn missing evidence into success before graph
 * policy runs. This checker-level scenario verifies the selected population and
 * resulting exit status, then confirms that genuine rendered blocks remain
 * excluded and scanning resumes after their real close tag.
 *
 * 1. Check two H1 requirements where prose after the first mentions opening,
 *    closing, and paired `pre` tags in inline code plus a `<prefix>` literal.
 * 2. Acknowledge only the first and require two selected requirements, one
 *    missing acknowledgement, and exit code one.
 * 3. Replace the prose with a genuine multiline `pre` block containing a fake
 *    heading, leaving the second real heading after its close.
 * 4. Require the fake heading to stay excluded while the second requirement
 *    remains selected and continues to prevent false success.
 * 5. Change the claim to Markdown whose close/open line leaves a rendered region
 *    around a fake citation, followed by one real citation after the final close.
 * 6. Require only the real citation to cover its target, retaining one missing
 *    requirement and exit code one.
 */
export async function test_markdown_literal_pre_graph(): Promise<void> {
  const location: string = join(__dirname, `literal pre graph ${randomUUID()}`);
  await EvidTestFileSystem.experiment(
    location,
    {
      "evid.json": JSON.stringify({
        claims: [
          {
            type: "typescript",
            files: ["claim.ts"],
            symbol: "function",
            reference: {
              type: "markdown",
              files: ["rules.md"],
              symbol: "h1",
            },
          },
        ],
      }),
      "claim.ts": `/** @evidence rules.md#first Implements the first rule. */\nexport function run(): void {}\n`,
      "rules.md": literalRules(),
    },
    async (directory: string): Promise<void> => {
      const config: string = join(directory, "evid.json");
      const literal: IEvidCheckReport = await EvidChecker.check(config);
      assertMissingSecond("literal rendered tags", literal);

      await EvidTestFileSystem.save(directory, {
        "rules.md": renderedRules(),
      });
      const rendered: IEvidCheckReport =
        await EvidChecker.check(config);
      assertMissingSecond("genuine rendered block", rendered);

      await EvidTestFileSystem.save(directory, {
        "evid.json": JSON.stringify({
          claims: [
            {
              type: "markdown",
              files: ["claim.md"],
              symbol: "h1",
              reference: {
                type: "markdown",
                files: ["rules.md"],
                symbol: "h1",
              },
            },
          ],
        }),
        "claim.md": orderedClaim(),
        "rules.md": literalRules(),
      });
      const ordered: IEvidCheckReport = await EvidChecker.check(config);
      assertMissingSecond("ordered rendered boundaries", ordered);
    },
  );
}

/**
 * Requires one of two Markdown requirements to remain uncovered.
 *
 * The first requirement has real evidence in each scenario; this assertion
 * proves that content made inert by rendered boundaries did not cover the second.
 */
function assertMissingSecond(
  label: string,
  report: IEvidCheckReport,
): void {
  const claim: IEvidCheckClaim | undefined = report.claims[0];
  const obligation: IEvidCheckObligation | undefined =
    claim === undefined ? undefined : claim.obligations[0];
  if (obligation === undefined)
    throw new Error(`${label} report has no graph obligation.`);
  TestValidator.equals(`${label} selected requirements`, obligation.units, 2);
  TestValidator.equals(
    `${label} covered requirements`,
    obligation.coveredUnits,
    1,
  );
  TestValidator.equals(`${label} exit code`, report.exitCode, 1);
  TestValidator.equals(
    `${label} missing acknowledgement`,
    report.diagnostics.filter(
      (diagnostic: IEvidDiagnostic): boolean =>
        diagnostic.code === "graph-missing-acknowledgement",
    ).length,
    1,
  );
}

/**
 * Builds requirements containing inline literal `pre` spellings.
 *
 * The literals remain ordinary semantic prose and cannot activate rendered-code
 * state before the second heading.
 */
function literalRules(): string {
  return [
    "# First {#first}",
    "",
    "Discuss `<pre>`, `</pre>`, and ``<pre></pre>`` in prose.",
    "A <prefix> marker is an ordinary literal.",
    "",
    "# Second {#second}",
    "",
    "A real requirement.",
    "",
  ].join("\n");
}

/**
 * Builds requirements with one heading inside a genuine rendered-code region.
 *
 * The hidden heading is excluded while the two surrounding real headings remain
 * the selected requirement population.
 */
function renderedRules(): string {
  return [
    "# First {#first}",
    "",
    "<pre>",
    "# Hidden {#hidden}",
    "</pre>",
    "",
    "# Second {#second}",
    "",
    "A real requirement.",
    "",
  ].join("\n");
}

/**
 * Builds a claim whose close-then-open line retains rendered state.
 *
 * A fake citation remains inside the reopened region, followed by the only real
 * citation after the final close.
 */
function orderedClaim(): string {
  return [
    "# Claim",
    "",
    "<pre>",
    "</pre><pre>",
    "<!-- @evidence rules.md#second Fake rendered acknowledgement. -->",
    "</pre>",
    "",
    "<!-- @evidence rules.md#first Real acknowledgement. -->",
    "",
  ].join("\n");
}
