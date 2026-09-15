import { EvidChecker, EvidWatcher } from "evid";
import type {
  EvidWatchCycle,
  IEvidSourceDependency,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/**
 * Publishes fresh results as an ESM package entry changes, fails, and recovers.
 *
 * Scanner-only resolution is insufficient protection for watch: the rebuilt
 * dependency set must drive another evaluator/checker cycle and replace the
 * previously published report. This scenario keeps the package boundary alive
 * through both content and topology changes.
 *
 * 1. Start an ESM config through a dual-export package whose import entry selects
 *    a covered source root; require a successful report and only the import entry
 *    in the active dependency set.
 * 2. Edit that entry in place to select an uncovered root; require the next
 *    published report to fail coverage and equal a fresh one-shot check.
 * 3. Repoint the package export map to a replacement entry selecting the covered
 *    root; require success and replacement of the active module dependency.
 * 4. Delete the selected replacement and require a failed configuration cycle,
 *    then recreate it without touching the config or manifest.
 * 5. Require the repaired cycle to recover, equal a fresh check, and continue
 *    observing the selected import entry rather than the unused require entry.
 */
export async function test_watch_package_conditions(): Promise<void> {
  const location: string = join(
    __dirname,
    `watch package conditions ${randomUUID()}`,
  );
  await TestFileSystem.experiment(
    location,
    {
      "package.json": JSON.stringify({ type: "module" }),
      "evid.config.ts": `import settings from "fixture-settings";\nexport default settings;\n`,
      "docs/requirements.md": `## Package entry {#package-entry}\n\nThe selected implementation must acknowledge this requirement.\n`,
      "src-covered/implementation.ts": implementation(true),
      "src-uncovered/implementation.ts": implementation(false),
      "node_modules/fixture-settings/package.json":
        exportManifest("./entry.js"),
      "node_modules/fixture-settings/entry.js": settings("src-covered"),
      "node_modules/fixture-settings/entry.d.ts": declaration(),
      "node_modules/fixture-settings/replacement.js": settings("src-covered"),
      "node_modules/fixture-settings/replacement.d.ts": declaration(),
      "node_modules/fixture-settings/unused.cjs": `module.exports = ${settingsObject("src-uncovered")};\n`,
    },
    async (directory: string): Promise<void> => {
      const configFile: string = join(directory, "evid.config.ts");
      const entry: string = join(
        directory,
        "node_modules/fixture-settings/entry.js",
      ).replaceAll("\\", "/");
      const replacement: string = join(
        directory,
        "node_modules/fixture-settings/replacement.js",
      ).replaceAll("\\", "/");
      const unused: string = join(
        directory,
        "node_modules/fixture-settings/unused.cjs",
      ).replaceAll("\\", "/");
      const watcher: EvidWatcher = new EvidWatcher(configFile, {
        pollIntervalMilliseconds: 20,
        debounceMilliseconds: 20,
      });

      await watcher.watch(async (cycle: EvidWatchCycle): Promise<void> => {
        const dependencies: string[] = watcher
          .dependencies()
          .map((dependency: IEvidSourceDependency): string =>
            dependency.path.replaceAll("\\", "/"),
          );
        if (cycle.cycle === 1) {
          if (!("report" in cycle))
            throw new Error(`Unexpected initial failure: ${cycle.message}`);
          TestValidator.predicate(
            "initial import entry succeeds",
            cycle.success,
          );
          TestValidator.predicate(
            "initial import entry observed",
            dependencies.includes(entry) && !dependencies.includes(unused),
          );
          await TestFileSystem.save(directory, {
            "node_modules/fixture-settings/entry.js": settings("src-uncovered"),
          });
          return;
        }
        if (cycle.cycle === 2) {
          if (!("report" in cycle))
            throw new Error(`Unexpected entry failure: ${cycle.message}`);
          TestValidator.equals(
            "edited entry matches fresh check",
            cycle.report,
            await EvidChecker.check(configFile),
          );
          TestValidator.predicate(
            "edited entry expires success",
            !cycle.success,
          );
          await TestFileSystem.save(directory, {
            "node_modules/fixture-settings/package.json":
              exportManifest("./replacement.js"),
          });
          return;
        }
        if (cycle.cycle === 3) {
          if (!("report" in cycle))
            throw new Error(`Unexpected repoint failure: ${cycle.message}`);
          TestValidator.equals(
            "repointed entry matches fresh check",
            cycle.report,
            await EvidChecker.check(configFile),
          );
          TestValidator.predicate(
            "repointed import entry succeeds",
            cycle.success,
          );
          TestValidator.predicate(
            "active dependency replaced",
            dependencies.includes(replacement) && !dependencies.includes(entry),
          );
          await TestFileSystem.erase(
            join(directory, "node_modules/fixture-settings/replacement.js"),
          );
          return;
        }
        if (cycle.cycle === 4) {
          TestValidator.predicate(
            "missing selected entry fails config",
            !("report" in cycle),
          );
          await TestFileSystem.save(directory, {
            "node_modules/fixture-settings/replacement.js":
              settings("src-covered"),
          });
          return;
        }
        if (!("report" in cycle))
          throw new Error(`Unexpected repair failure: ${cycle.message}`);
        TestValidator.equals("repaired entry cycle", cycle.cycle, 5);
        TestValidator.equals(
          "repaired entry matches fresh check",
          cycle.report,
          await EvidChecker.check(configFile),
        );
        TestValidator.predicate(
          "repaired import entry succeeds",
          cycle.success,
        );
        TestValidator.predicate(
          "repaired import entry observed",
          dependencies.includes(replacement) && !dependencies.includes(unused),
        );
        await watcher.close();
      });
    },
  );
}

/**
 * Builds the conditional package export used by the watch fixture.
 *
 * The import target is mutable while the unused require target remains a control
 * that must stay outside the active dependency set.
 */
function exportManifest(entry: string): string {
  return JSON.stringify({
    name: "fixture-settings",
    type: "module",
    exports: { import: entry, require: "./unused.cjs" },
  });
}

/**
 * Wraps one serialized settings object as an ESM default export.
 *
 * Package entry mutations reuse this exact module shape so only the configured
 * claim root changes the resulting coverage state.
 */
function settings(root: string): string {
  return `export default ${settingsObject(root)};\n`;
}

/**
 * Serializes the Evid configuration selected by the package entry.
 *
 * The root identifies which fixture source the programming claim observes while
 * all other policy remains fixed.
 */
function settingsObject(root: string): string {
  return JSON.stringify({
    claims: [
      {
        type: "typescript",
        root,
        files: ["**/*.ts"],
        symbol: "function",
        reference: {
          type: "markdown",
          files: ["docs/**/*.md"],
          symbol: "h2",
        },
      },
    ],
  });
}

/**
 * Provides the declaration counterpart required by TypeScript config loading.
 *
 * It describes the JavaScript package entry without becoming a runtime watch
 * target.
 */
function declaration(): string {
  return `declare const settings: unknown;\nexport default settings;\n`;
}

/**
 * Builds the source selected by a package-provided claim.
 *
 * The boolean controls only whether the surviving function acknowledges the
 * requirement, allowing watch cycles to compare covered and uncovered entries.
 */
function implementation(covered: boolean): string {
  const documentation: string = covered
    ? `/** @evid docs/requirements.md#package-entry Implements the selected package contract. */\n`
    : "";
  return `${documentation}export function selected(): number { return 1; }\n`;
}
