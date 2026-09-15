import {
  EvidFingerprint,
  EvidMarkdownAdapter,
  EvidSourceLoader,
  EvidTypeScriptAdapter,
} from "evid";
import type {
  IEvidInventory,
  IEvidSourceFile,
  IEvidSourceSnapshot,
  IEvidUnit,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/**
 * Preserves review fingerprints across real checkout and file-identity changes.
 *
 * Source discovery uses device/inode identity to reconcile aliases within one
 * snapshot. Review hashes need a separate durable declaring path or identical
 * checked-in content will disagree between a developer checkout, CI, and an
 * editor's replacement save.
 *
 * 1. Discover and analyze identical Markdown files from two independent
 *    checkout roots; require different snapshot IDs but equal heading hashes.
 * 2. Replace one file at the same path with byte-identical content through
 *    renames; require its filesystem identity to change and its hash to remain.
 * 3. Change the heading's semantic prose and require the hash to expire.
 * 4. Load an LF/CRLF checkout pair and require equal hashes.
 * 5. Analyze two different declaring paths with identical anchored content and
 *    require distinct hashes, preserving declaration rebinding sensitivity.
 * 6. Add an unrelated source whose process-local ID prefixes the reviewed
 *    source ID; require the reviewed TypeScript fingerprint to remain stable.
 */
export async function test_fingerprint_portability(): Promise<void> {
  const location: string = join(
    __dirname,
    `fingerprint portability ${randomUUID()}`,
  );
  const content: string = `# Rule {#rule}\n\nDo the work.\n`;
  await TestFileSystem.experiment(
    location,
    {
      "checkout-a/evid.config.ts": `export default {};\n`,
      "checkout-a/rules.md": content,
      "checkout-b/evid.config.ts": `export default {};\n`,
      "checkout-b/rules.md": content,
      "checkout-crlf/evid.config.ts": `export default {};\r\n`,
      "checkout-crlf/rules.md": content.replaceAll("\n", "\r\n"),
    },
    async (directory: string): Promise<void> => {
      const firstConfig: string = join(
        directory,
        "checkout-a/evid.config.ts",
      );
      const secondConfig: string = join(
        directory,
        "checkout-b/evid.config.ts",
      );
      const crlfConfig: string = join(
        directory,
        "checkout-crlf/evid.config.ts",
      );
      const firstSnapshot: IEvidSourceSnapshot =
        await EvidSourceLoader.glob(firstConfig, { files: ["rules.md"] });
      const secondSnapshot: IEvidSourceSnapshot =
        await EvidSourceLoader.glob(secondConfig, { files: ["rules.md"] });
      const firstInventory: IEvidInventory =
        await new EvidMarkdownAdapter().analyze(firstSnapshot);
      const secondInventory: IEvidInventory =
        await new EvidMarkdownAdapter().analyze(secondSnapshot);
      const firstUnit: IEvidUnit = rule(firstInventory);
      const secondUnit: IEvidUnit = rule(secondInventory);
      const baseline: string = EvidFingerprint.inspect(
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
        EvidFingerprint.inspect(secondInventory, secondUnit.id).fingerprint,
        baseline,
      );

      const active: string = join(directory, "checkout-a/rules.md");
      const replacement: string = join(directory, "checkout-a/rules.new.md");
      const retired: string = join(directory, "checkout-a/rules.old.md");
      await TestFileSystem.save(directory, {
        "checkout-a/rules.new.md": content,
      });
      await rename(active, retired);
      await rename(replacement, active);
      await rm(retired);
      const replacedSnapshot: IEvidSourceSnapshot =
        await EvidSourceLoader.glob(firstConfig, { files: ["rules.md"] });
      const replacedInventory: IEvidInventory =
        await new EvidMarkdownAdapter().analyze(replacedSnapshot);
      TestValidator.notEquals(
        "replacement changes snapshot identity",
        replacedSnapshot.files[0]?.id,
        firstSnapshot.files[0]?.id,
      );
      TestValidator.equals(
        "identical replacement fingerprint",
        EvidFingerprint.inspect(
          replacedInventory,
          rule(replacedInventory).id,
        ).fingerprint,
        baseline,
      );

      await TestFileSystem.save(directory, {
        "checkout-a/rules.md": content.replace("Do the work.", "Do more work."),
      });
      const changedSnapshot: IEvidSourceSnapshot =
        await EvidSourceLoader.glob(firstConfig, { files: ["rules.md"] });
      const changedInventory: IEvidInventory =
        await new EvidMarkdownAdapter().analyze(changedSnapshot);
      TestValidator.notEquals(
        "semantic edit expires portable fingerprint",
        EvidFingerprint.inspect(changedInventory, rule(changedInventory).id)
          .fingerprint,
        baseline,
      );

      const crlfSnapshot: IEvidSourceSnapshot =
        await EvidSourceLoader.glob(crlfConfig, { files: ["rules.md"] });
      const crlfInventory: IEvidInventory =
        await new EvidMarkdownAdapter().analyze(crlfSnapshot);
      TestValidator.equals(
        "line-ending portable fingerprint",
        EvidFingerprint.inspect(crlfInventory, rule(crlfInventory).id)
          .fingerprint,
        baseline,
      );

      await TestFileSystem.save(directory, {
        "checkout-b/other.md": content,
      });
      const distinctSnapshot: IEvidSourceSnapshot =
        await EvidSourceLoader.glob(secondConfig, {
          files: ["rules.md", "other.md"],
        });
      const distinctInventory: IEvidInventory =
        await new EvidMarkdownAdapter().analyze(distinctSnapshot);
      const distinct: string[] = distinctInventory.units
        .filter(
          (unit: IEvidUnit): boolean => unit.identity.at(-1) === "rule",
        )
        .map(
          (unit: IEvidUnit): string =>
            EvidFingerprint.inspect(distinctInventory, unit.id).fingerprint,
        );
      TestValidator.equals(
        "different declaring paths remain distinct",
        new Set<string>(distinct).size,
        2,
      );
    },
  );

  const targetSnapshot: IEvidSourceSnapshot = TestSourceSnapshot.create(
    "target.ts",
    "export interface Rule { value: string; }\n",
  );
  const targetSource: IEvidSourceFile | undefined = targetSnapshot.files[0];
  if (targetSource === undefined)
    throw new Error("Target portability snapshot is empty.");
  targetSource.id = "source:ab";
  const unrelatedSnapshot: IEvidSourceSnapshot = TestSourceSnapshot.create(
    "unrelated/with-a-longer-physical-path.ts",
    "export interface Noise { value: string; }\n",
  );
  const unrelatedSource: IEvidSourceFile | undefined =
    unrelatedSnapshot.files[0];
  if (unrelatedSource === undefined)
    throw new Error("Unrelated portability snapshot is empty.");
  unrelatedSource.id = "source:a";

  const adapter: EvidTypeScriptAdapter = new EvidTypeScriptAdapter();
  const isolated: IEvidInventory = await adapter.analyze(targetSnapshot);
  const combined: IEvidInventory = await adapter.analyze(
    TestSourceSnapshot.combine([unrelatedSnapshot, targetSnapshot]),
  );
  TestValidator.equals(
    "prefixing source identity does not change fingerprint",
    EvidFingerprint.inspect(combined, typedRule(combined).id).fingerprint,
    EvidFingerprint.inspect(isolated, typedRule(isolated).id).fingerprint,
  );
}

/**
 * Requires the explicitly anchored heading used by portability comparisons.
 *
 * Failing on absence or duplication prevents a loader/parser regression from
 * being mistaken for a fingerprint result.
 */
function rule(inventory: IEvidInventory): IEvidUnit {
  const units: IEvidUnit[] = inventory.units.filter(
    (unit: IEvidUnit): boolean => unit.identity.at(-1) === "rule",
  );
  const unit: IEvidUnit | undefined = units[0];
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
function typedRule(inventory: IEvidInventory): IEvidUnit {
  const units: IEvidUnit[] = inventory.units.filter(
    (unit: IEvidUnit): boolean =>
      unit.symbol === "type" && unit.identity.join(".") === "Rule",
  );
  const unit: IEvidUnit | undefined = units[0];
  if (units.length !== 1 || unit === undefined)
    throw new Error("Expected exactly one TypeScript Rule interface.");
  return unit;
}
