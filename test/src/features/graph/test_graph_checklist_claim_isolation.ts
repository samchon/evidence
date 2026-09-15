import { EvidenceChecker } from "@wrtnlabs/evidence";
import type {
  EvidenceCommandExitCode,
  EvidenceProgrammingSymbol,
  EvidenceSeverity,
  IEvidenceCheckReport,
  IEvidenceDiagnostic,
  IEvidenceProgrammingClaim,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Keeps deferred checklist findings inside their authored claim boundary.
 *
 * Reusing one source inventory across claims also reuses declaration IDs. The
 * evaluator must retain authored claim indices while preventing a broader,
 * lower-severity, or incomplete sibling claim from consuming another claim's
 * deferred unhosted acknowledgement.
 *
 * 1. Start with one disabled claim, a broad warning claim, and a narrow error
 *    claim whose off-selector function citation must remain unhosted.
 * 2. Put the broad claim before and after the narrow claim; require exit code one,
 *    one unhosted diagnostic, and the narrow claim's authored index each time.
 * 3. Remove the broad claim and require the same narrow-claim failure, proving the
 *    added claim does not change the original obligation.
 * 4. Add an incomplete sibling claim before the narrow claim; require exit code
 *    two while preserving the narrow claim's unhosted diagnostic and index.
 */
export async function test_graph_checklist_claim_isolation(): Promise<void> {
  const location: string = join(
    __dirname,
    `checklist claim isolation ${randomUUID()}`,
  );
  await EvidenceTestFileSystem.experiment(
    location,
    {
      "claims.ts": [
        "/** @evidence rules.md#rule Implements the rule. */",
        "export function run(): void {}",
        "/** @evidence rules.md#rule Defines the rule. */",
        "export interface Shape {}",
        "",
      ].join("\n"),
      "rules.md": `# Rule {#rule}\n\nDo the work.\n`,
    },
    async (directory: string): Promise<void> => {
      const config: string = join(directory, "evidence.json");
      const disabled: IEvidenceProgrammingClaim = claim("type", "off");
      const broad: IEvidenceProgrammingClaim = claim(
        ["type", "function"],
        "warning",
      );
      const narrow: IEvidenceProgrammingClaim = claim("type", "error");

      await check(directory, config, [disabled, broad, narrow], 2, 1);
      await check(directory, config, [disabled, narrow, broad], 1, 1);
      await check(directory, config, [disabled, narrow], 1, 1);
      await check(
        directory,
        config,
        [disabled, incompleteClaim(), narrow],
        2,
        2,
      );
    },
  );
}

/**
 * Builds one claim over the shared TypeScript and checklist fixtures.
 *
 * Severity and symbol selection are the only varying policy inputs so every
 * scenario resolves the same physical declarations and reference unit.
 */
function claim(
  symbol: EvidenceProgrammingSymbol | EvidenceProgrammingSymbol[],
  severity: EvidenceSeverity,
): IEvidenceProgrammingClaim {
  return {
    type: "typescript",
    files: ["claims.ts"],
    symbol,
    severity,
    reference: {
      type: "markdown",
      files: ["rules.md"],
      symbol: "h1",
      checklist: true,
    },
  };
}

/**
 * Builds an unrelated claim whose reference discovery cannot complete.
 *
 * Its uncertainty must remain local even though it reuses the claim inventory
 * and declaration IDs exercised by the complete checklist claim.
 */
function incompleteClaim(): IEvidenceProgrammingClaim {
  return {
    ...claim("type", "error"),
    reference: {
      type: "markdown",
      root: "missing-root",
      files: ["missing.md"],
      symbol: "h1",
      checklist: true,
    },
  };
}

/**
 * Writes one claim order and verifies its public checker outcome.
 *
 * The expected diagnostic index is authored configuration state, while the exit
 * code distinguishes an ordinary coverage failure from an incomplete sibling.
 */
async function check(
  directory: string,
  config: string,
  claims: IEvidenceProgrammingClaim[],
  expectedClaim: number,
  exitCode: EvidenceCommandExitCode,
): Promise<void> {
  await EvidenceTestFileSystem.save(directory, {
    "evidence.json": JSON.stringify({ claims }),
  });
  const report: IEvidenceCheckReport = await EvidenceChecker.check(config);
  const unhosted: IEvidenceDiagnostic[] = report.diagnostics.filter(
    (diagnostic: IEvidenceDiagnostic): boolean =>
      diagnostic.code === "graph-unhosted-checklist",
  );
  TestValidator.equals(
    "claim-isolated checker exit",
    report.exitCode,
    exitCode,
  );
  TestValidator.equals("claim-isolated unhosted count", unhosted.length, 1);
  TestValidator.equals(
    "claim-isolated authored index",
    unhosted[0]?.claim,
    expectedClaim,
  );
}
