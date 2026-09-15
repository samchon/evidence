import {
  EvidenceFingerprint,
  EvidenceMarkdownAdapter,
  EvidenceSourceLoader,
  EvidenceTypeScriptAdapter,
} from "evidence";
import type {
  IEvidenceInventory,
  IEvidenceSourceFile,
  IEvidenceSourceSnapshot,
  IEvidenceUnit,
} from "evidence";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Preserves review fingerprints across real checkout and file-identity changes.
 *
 * Source discovery uses device/inode identity to reconcile aliases within one
 * snapshot. Review hashes need a separate durable declaring path or identical
 * checked-in content will disagree between a developer checkout, CI, and an
 * editor's replacement save.
 *
 * 1. Discover and analyze identical Markdown files from two independent checkout
 *    roots; require different snapshot IDs but equal heading hashes.
 * 2. Replace one file at the same path with byte-identical content through
 *    renames; require its filesystem identity to change and its hash to
 *    remain.
 * 3. Change the heading's semantic prose and require the hash to expire.
 * 4. Load an LF/CRLF checkout pair and require equal hashes.
 * 5. Analyze two different declaring paths with identical anchored content and
 *    require distinct hashes, preserving declaration rebinding sensitivity.
 * 6. Add an unrelated source whose process-local ID prefixes the reviewed source
 *    ID; require the reviewed TypeScript fingerprint to remain stable.
 */
export async function test_fingerprint_portability(): Promise<void> {
  const location: string = join(
    __dirname,
    `fingerprint portability ${randomUUID()}`,
  );
  const content: string = `# Rule {#rule}\n\nDo the work.\n`;
  await EvidenceTestFileSystem.experiment(
    location,
    {
      "checkout-a/evidence.config.ts": `export default {};\n`,
      "checkout-a/rules.md": content,
      "checkout-b/evidence.config.ts": `export default {};\n`,
      "checkout-b/rules.md": content,
      "checkout-crlf/evidence.config.ts": `export default {};\r\n`,
      "checkout-crlf/rules.md": content.replaceAll("\n", "\r\n"),
    },
    async (directory: string): Promise<void> => {
      const firstConfig: string = join(
        directory,
        "checkout-a/evidence.config.ts",
      );
      const secondConfig: string = join(
        directory,
        "checkout-b/evidence.config.ts",
      );
      const crlfConfig: string = join(
        directory,
        "checkout-crlf/evidence.config.ts",
      );
      const firstSnapshot: IEvidenceSourceSnapshot =
        await EvidenceSourceLoader.glob(firstConfig, { files: ["rules.md"] });
      const secondSnapshot: IEvidenceSourceSnapshot =
        await EvidenceSourceLoader.glob(secondConfig, { files: ["rules.md"] });
      const firstInventory: IEvidenceInventory =
        await new EvidenceMarkdownAdapter().analyze(firstSnapshot);
      const secondInventory: IEvidenceInventory =
        await new EvidenceMarkdownAdapter().analyze(secondSnapshot);
      const firstUnit: IEvidenceUnit = rule(firstInventory);
      const secondUnit: IEvidenceUnit = rule(secondInventory);
      const baseline: string = EvidenceFingerprint.inspect(
        firstInventory,
        firstUnit.id,
      ).fingerprint;

      TestValidator.notEquals(
        "independent checkout source identities",
        firstSnapshot.files[0]?.id,
        secondSnapshot.files[0]?.id,
      );
      TestValidator.equals(
        "independent checkout fingerprint",
        EvidenceFingerprint.inspect(secondInventory, secondUnit.id).fingerprint,
        baseline,
      );

      const active: string = join(directory, "checkout-a/rules.md");
      const replacement: string = join(directory, "checkout-a/rules.new.md");
      const retired: string = join(directory, "checkout-a/rules.old.md");
      await EvidenceTestFileSystem.save(directory, {
        "checkout-a/rules.new.md": content,
      });
      await rename(active, retired);
      await rename(replacement, active);
      await rm(retired);
      const replacedSnapshot: IEvidenceSourceSnapshot =
        await EvidenceSourceLoader.glob(firstConfig, { files: ["rules.md"] });
      const replacedInventory: IEvidenceInventory =
        await new EvidenceMarkdownAdapter().analyze(replacedSnapshot);
      TestValidator.notEquals(
        "replacement changes snapshot identity",
        replacedSnapshot.files[0]?.id,
        firstSnapshot.files[0]?.id,
      );
      TestValidator.equals(
        "identical replacement fingerprint",
        EvidenceFingerprint.inspect(
          replacedInventory,
          rule(replacedInventory).id,
        ).fingerprint,
        baseline,
      );

      await EvidenceTestFileSystem.save(directory, {
        "checkout-a/rules.md": content.replace("Do the work.", "Do more work."),
      });
      const changedSnapshot: IEvidenceSourceSnapshot =
        await EvidenceSourceLoader.glob(firstConfig, { files: ["rules.md"] });
      const changedInventory: IEvidenceInventory =
        await new EvidenceMarkdownAdapter().analyze(changedSnapshot);
      TestValidator.notEquals(
        "semantic edit expires portable fingerprint",
        EvidenceFingerprint.inspect(changedInventory, rule(changedInventory).id)
          .fingerprint,
        baseline,
      );

      const crlfSnapshot: IEvidenceSourceSnapshot =
        await EvidenceSourceLoader.glob(crlfConfig, { files: ["rules.md"] });
      const crlfInventory: IEvidenceInventory =
        await new EvidenceMarkdownAdapter().analyze(crlfSnapshot);
      TestValidator.equals(
        "line-ending portable fingerprint",
        EvidenceFingerprint.inspect(crlfInventory, rule(crlfInventory).id)
          .fingerprint,
        baseline,
      );

      await EvidenceTestFileSystem.save(directory, {
        "checkout-b/other.md": content,
      });
      const distinctSnapshot: IEvidenceSourceSnapshot =
        await EvidenceSourceLoader.glob(secondConfig, {
          files: ["rules.md", "other.md"],
        });
      const distinctInventory: IEvidenceInventory =
        await new EvidenceMarkdownAdapter().analyze(distinctSnapshot);
      const distinct: string[] = distinctInventory.units
        .filter(
          (unit: IEvidenceUnit): boolean => unit.identity.at(-1) === "rule",
        )
        .map(
          (unit: IEvidenceUnit): string =>
            EvidenceFingerprint.inspect(distinctInventory, unit.id).fingerprint,
        );
      TestValidator.equals(
        "different declaring paths remain distinct",
        new Set<string>(distinct).size,
        2,
      );
    },
  );

  const targetSnapshot: IEvidenceSourceSnapshot =
    EvidenceTestSourceSnapshot.create(
      "target.ts",
      "export interface Rule { value: string; }\n",
    );
  const targetSource: IEvidenceSourceFile | undefined = targetSnapshot.files[0];
  if (targetSource === undefined)
    throw new Error("Target portability snapshot is empty.");
  targetSource.id = "source:ab";
  const unrelatedSnapshot: IEvidenceSourceSnapshot =
    EvidenceTestSourceSnapshot.create(
      "unrelated/with-a-longer-physical-path.ts",
      "export interface Noise { value: string; }\n",
    );
  const unrelatedSource: IEvidenceSourceFile | undefined =
    unrelatedSnapshot.files[0];
  if (unrelatedSource === undefined)
    throw new Error("Unrelated portability snapshot is empty.");
  unrelatedSource.id = "source:a";

  const adapter: EvidenceTypeScriptAdapter = new EvidenceTypeScriptAdapter();
  const isolated: IEvidenceInventory = await adapter.analyze(targetSnapshot);
  const combined: IEvidenceInventory = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([unrelatedSnapshot, targetSnapshot]),
  );
  TestValidator.equals(
    "prefixing source identity does not change fingerprint",
    EvidenceFingerprint.inspect(combined, typedRule(combined).id).fingerprint,
    EvidenceFingerprint.inspect(isolated, typedRule(isolated).id).fingerprint,
  );
}

/**
 * Requires the explicitly anchored heading used by portability comparisons.
 *
 * Failing on absence or duplication prevents a loader/parser regression from
 * being mistaken for a fingerprint result.
 */
function rule(inventory: IEvidenceInventory): IEvidenceUnit {
  const units: IEvidenceUnit[] = inventory.units.filter(
    (unit: IEvidenceUnit): boolean => unit.identity.at(-1) === "rule",
  );
  const unit: IEvidenceUnit | undefined = units[0];
  if (units.length !== 1 || unit === undefined)
    throw new Error("Expected exactly one anchored rule heading.");
  return unit;
}

/**
 * Requires the TypeScript interface used by source-token collision checks.
 *
 * Selecting by its segmented identity keeps an unrelated declaration from
 * influencing which fingerprint the assertion compares.
 */
function typedRule(inventory: IEvidenceInventory): IEvidenceUnit {
  const units: IEvidenceUnit[] = inventory.units.filter(
    (unit: IEvidenceUnit): boolean =>
      unit.symbol === "type" && unit.identity.join(".") === "Rule",
  );
  const unit: IEvidenceUnit | undefined = units[0];
  if (units.length !== 1 || unit === undefined)
    throw new Error("Expected exactly one TypeScript Rule interface.");
  return unit;
}
