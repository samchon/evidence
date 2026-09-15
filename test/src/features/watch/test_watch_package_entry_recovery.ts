import {
  EvidenceConfigLoader,
  type IEvidenceConfig,
  type IEvidenceSourceDependency,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { ConfigDependencyScanner } from "../../../../packages/evidence/src/internal/ConfigDependencyScanner";
import { WatchDependencySnapshot } from "../../../../packages/evidence/src/internal/WatchDependencySnapshot";
import { TestFileSystem } from "../../internal/TestFileSystem";

/**
 * Rebuilds package dependencies after manifest changes in one parent process.
 *
 * Node's path resolver can retain an earlier `main` result after package metadata
 * changes. Watch must instead agree with each fresh config evaluation and retain
 * enough failed-state dependencies for repair to trigger another attempt.
 *
 * 1. Load and scan a CommonJS config whose package initially selects `first.cjs`.
 * 2. Repoint `main` to `second.cjs` and require both the fresh evaluator and a
 *    new scanner in the same process to select the second entry.
 * 3. Capture the rebuilt dependency set, edit only `second.cjs`, and require its
 *    snapshot to change while an unchanged positive control remains equal.
 * 4. Switch back to the first entry and require resolution to follow again.
 * 5. Select a missing entry, require a visible scan failure, then create that
 *    exact file and require the retained failed snapshot to invalidate and a new
 *    scan to recover.
 * 6. Corrupt and restore the manifest, requiring the manifest dependency to
 *    survive the failure and normal package resolution to resume after repair.
 */
export async function test_watch_package_entry_recovery(): Promise<void> {
  const location: string = join(
    __dirname,
    `package entry recovery ${randomUUID()}`,
  );
  await TestFileSystem.experiment(
    location,
    {
      "package.json": JSON.stringify({ type: "commonjs" }),
      "evidence.config.ts": `import settings from "fixture-settings";\nexport default settings;\n`,
      "rules.md": `# Package settings\n`,
      "node_modules/fixture-settings/package.json":
        packageManifest("first.cjs"),
      "node_modules/fixture-settings/first.cjs": settings("error"),
      "node_modules/fixture-settings/first.d.cts": declaration(),
      "node_modules/fixture-settings/second.cjs": settings("warning"),
      "node_modules/fixture-settings/second.d.cts": declaration(),
    },
    async (directory: string): Promise<void> => {
      const configFile: string = join(directory, "evidence.config.ts");
      const manifestFile: string = join(
        directory,
        "node_modules/fixture-settings/package.json",
      );
      const firstFile: string = join(
        directory,
        "node_modules/fixture-settings/first.cjs",
      );
      const secondFile: string = join(
        directory,
        "node_modules/fixture-settings/second.cjs",
      );
      const missingFile: string = join(
        directory,
        "node_modules/fixture-settings/missing.cjs",
      );
      const normalized: (file: string) => string = (file: string): string =>
        file.replaceAll("\\", "/");

      const firstConfig: IEvidenceConfig =
        await EvidenceConfigLoader.load(configFile);
      const firstDependencies: IEvidenceSourceDependency[] =
        await new ConfigDependencyScanner(configFile).scan();
      TestValidator.equals(
        "initial package severity",
        firstConfig.severity,
        "error",
      );
      TestValidator.predicate(
        "initial package entry",
        paths(firstDependencies).includes(normalized(firstFile)),
      );

      await TestFileSystem.save(directory, {
        "node_modules/fixture-settings/package.json":
          packageManifest("second.cjs"),
      });
      const secondConfig: IEvidenceConfig =
        await EvidenceConfigLoader.load(configFile);
      const secondDependencies: IEvidenceSourceDependency[] =
        await new ConfigDependencyScanner(configFile).scan();
      TestValidator.equals(
        "repointed package severity",
        secondConfig.severity,
        "warning",
      );
      TestValidator.predicate(
        "repointed package entry",
        paths(secondDependencies).includes(normalized(secondFile)),
      );
      TestValidator.predicate(
        "obsolete package entry removed",
        !paths(secondDependencies).includes(normalized(firstFile)),
      );

      const stable: WatchDependencySnapshot =
        await WatchDependencySnapshot.capture(secondDependencies);
      const repeated: WatchDependencySnapshot =
        await WatchDependencySnapshot.capture(secondDependencies);
      TestValidator.predicate(
        "unchanged package snapshot",
        stable.equals(repeated),
      );
      await TestFileSystem.save(directory, {
        "node_modules/fixture-settings/second.cjs": settings("off"),
      });
      const edited: WatchDependencySnapshot =
        await WatchDependencySnapshot.capture(secondDependencies);
      TestValidator.predicate(
        "active entry content invalidates snapshot",
        !stable.equals(edited),
      );

      await TestFileSystem.save(directory, {
        "node_modules/fixture-settings/package.json":
          packageManifest("first.cjs"),
      });
      const returned: IEvidenceSourceDependency[] =
        await new ConfigDependencyScanner(configFile).scan();
      TestValidator.predicate(
        "repeated package entry switch",
        paths(returned).includes(normalized(firstFile)),
      );

      await TestFileSystem.save(directory, {
        "node_modules/fixture-settings/package.json":
          packageManifest("missing.cjs"),
      });
      const missingScanner: ConfigDependencyScanner =
        new ConfigDependencyScanner(configFile);
      let missingFailed: boolean = false;
      try {
        await missingScanner.scan();
      } catch {
        missingFailed = true;
      }
      TestValidator.predicate("missing selected entry fails", missingFailed);
      const missingDependencies: IEvidenceSourceDependency[] =
        missingScanner.list();
      TestValidator.predicate(
        "missing selected entry retained",
        paths(missingDependencies).includes(normalized(missingFile)),
      );
      const absent: WatchDependencySnapshot =
        await WatchDependencySnapshot.capture(missingDependencies);
      await TestFileSystem.save(directory, {
        "node_modules/fixture-settings/missing.cjs": settings("warning"),
      });
      const repaired: WatchDependencySnapshot =
        await WatchDependencySnapshot.capture(missingDependencies);
      TestValidator.predicate(
        "selected entry repair invalidates snapshot",
        !absent.equals(repaired),
      );
      const recovered: IEvidenceSourceDependency[] =
        await new ConfigDependencyScanner(configFile).scan();
      TestValidator.predicate(
        "repaired selected entry resolves",
        paths(recovered).includes(normalized(missingFile)),
      );

      await TestFileSystem.save(directory, {
        "node_modules/fixture-settings/package.json": `{"name": 1}`,
      });
      let malformedEvaluationFailed: boolean = false;
      try {
        await EvidenceConfigLoader.load(configFile);
      } catch {
        malformedEvaluationFailed = true;
      }
      TestValidator.predicate(
        "malformed package manifest prevents evaluation",
        malformedEvaluationFailed,
      );
      const malformedScanner: ConfigDependencyScanner =
        new ConfigDependencyScanner(configFile);
      let malformedFailed: boolean = false;
      try {
        await malformedScanner.scan();
      } catch {
        malformedFailed = true;
      }
      TestValidator.predicate(
        "malformed package manifest fails",
        malformedFailed,
      );
      TestValidator.predicate(
        "malformed manifest retained",
        paths(malformedScanner.list()).includes(normalized(manifestFile)),
      );
      await TestFileSystem.save(directory, {
        "node_modules/fixture-settings/package.json":
          packageManifest("first.cjs"),
      });
      const restored: IEvidenceSourceDependency[] =
        await new ConfigDependencyScanner(configFile).scan();
      TestValidator.predicate(
        "restored manifest resolves",
        paths(restored).includes(normalized(firstFile)),
      );
    },
  );
}

/**
 * Builds the legacy package manifest for one selected CommonJS entry.
 *
 * Rewriting only `main` lets the scenario verify dependency replacement and
 * recovery without changing package identity.
 */
function packageManifest(main: string): string {
  return JSON.stringify({ name: "fixture-settings", main });
}

/**
 * Builds the CommonJS Evidence configuration exported by a package entry.
 *
 * Severity identifies which runtime file won while the claim body remains a
 * stable valid configuration.
 */
function settings(severity: "error" | "off" | "warning"): string {
  return `module.exports = { severity: ${JSON.stringify(severity)}, claims: [{ type: "markdown", files: ["rules.md"], reference: { type: "markdown", files: ["rules.md"] } }] };\n`;
}

/**
 * Provides the declaration counterpart for the CommonJS settings package.
 *
 * Config evaluation may consult this type file, but runtime dependency scanning
 * must select the JavaScript entry named by `main`.
 */
function declaration(): string {
  return `declare const settings: unknown;\nexport = settings;\n`;
}

/**
 * Normalizes dependency paths for platform-independent fixture assertions.
 *
 * Watch records retain native paths; slash normalization keeps expected values
 * stable on Windows and POSIX runners.
 */
function paths(dependencies: IEvidenceSourceDependency[]): string[] {
  return dependencies.map((dependency: IEvidenceSourceDependency): string =>
    dependency.path.replaceAll("\\", "/"),
  );
}
