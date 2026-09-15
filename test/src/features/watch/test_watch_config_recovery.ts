import { EvidenceChecker, EvidenceWatcher } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Recovers from imported configuration failures and missing active roots.
 *
 * A watcher must track active configuration imports and their recovered source
 * roots while omitting disabled populations from its runtime dependency set.
 *
 * 1. Start with an imported active root, a disabled claim, and a covered Markdown
 *    requirement; require success, the helper dependency, and no disabled-root
 *    dependency.
 * 2. Introduce a type error in the imported helper and require a failed cycle that
 *    replaces the earlier success.
 * 3. Repair the helper to select a missing active root; require an incomplete
 *    cycle whose report equals a fresh checker result.
 * 4. Create the missing root and covered implementation, then require recovery
 *    without restarting the watcher.
 */
export async function test_watch_config_recovery(): Promise<void> {
  const location = join(__dirname, `config recovery ${randomUUID()}`);
  await EvidenceTestFileSystem.experiment(
    location,
    {
      "evidence.config.ts": config(),
      "helpers/settings.ts": settings("src"),
      "docs/requirements.md": requirement(),
      "src/implementation.ts": implementation(),
    },
    async (directory) => {
      const configFile = join(directory, "evidence.config.ts");
      const helper = join(directory, "helpers", "settings.ts");
      const watcher = new EvidenceWatcher(configFile, {
        pollIntervalMilliseconds: 20,
        debounceMilliseconds: 20,
      });

      await watcher.watch(async (cycle) => {
        // The initial active set includes runtime config imports and excludes disabled roots.
        if (cycle.cycle === 1) {
          if (cycle.status === "failed")
            throw new Error(`Unexpected initial failure: ${cycle.message}`);
          TestValidator.predicate("initial config succeeds", cycle.success);
          const dependencies = watcher
            .dependencies()
            .map((dependency) => dependency.path.replaceAll("\\", "/"));
          TestValidator.predicate(
            "config import dependency",
            dependencies.includes(helper.replaceAll("\\", "/")),
          );
          TestValidator.predicate(
            "disabled root omitted",
            dependencies.every(
              (dependency) => !dependency.includes("disabled-source"),
            ),
          );
          await EvidenceTestFileSystem.save(directory, {
            "helpers/settings.ts": `export const root: string = 123;\nexport const files = ["**/*.ts"];\n`,
          });
          return;
        }

        // The current imported type error replaces the old success with a failure cycle.
        if (cycle.cycle === 2) {
          TestValidator.equals("config failure status", cycle.status, "failed");
          await EvidenceTestFileSystem.save(directory, {
            "helpers/settings.ts": settings("missing-source"),
          });
          return;
        }
        if (cycle.status === "failed")
          throw new Error(
            `Unexpected repaired config failure: ${cycle.message}`,
          );

        // Repairing the config import selects a missing root and reports it as incomplete.
        TestValidator.equals(
          `fresh config report ${cycle.cycle}`,
          cycle.report,
          await EvidenceChecker.check(configFile),
        );
        if (cycle.cycle === 3) {
          TestValidator.equals(
            "missing root status",
            cycle.status,
            "incomplete",
          );
          await EvidenceTestFileSystem.save(directory, {
            "missing-source/implementation.ts": implementation(),
          });
          return;
        }

        // Creating the formerly missing root is discovered without restarting the watcher.
        TestValidator.equals("recreated root cycle", cycle.cycle, 4);
        TestValidator.predicate("recreated root succeeds", cycle.success);
        await watcher.close();
      });
    },
  );
}

function config(): string {
  return dedent`
    import { files, root } from "./helpers/settings";
    import type { IEvidenceConfig } from "evidence";

    export default {
      claims: [
        {
          type: "typescript",
          root,
          files,
          symbol: "function",
          reference: {
            type: "markdown",
            files: ["docs/**/*.md"],
            symbol: "h2",
          },
        },
        {
          type: "typescript",
          disabled: true,
          root: "disabled-source",
          files: ["**/*.ts"],
          reference: {
            type: "markdown",
            root: "disabled-docs",
            files: ["**/*.md"],
          },
        },
      ],
    } satisfies IEvidenceConfig;
  `;
}

function settings(root: string): string {
  return dedent`
    export const root = ${JSON.stringify(root)};
    export const files = ["**/*.ts"];
  `;
}

function requirement(): string {
  return dedent`
    ## Pricing {#pricing}

    The implementation must calculate pricing.
  `;
}

function implementation(): string {
  return dedent`
    /** @evidence docs/requirements.md#pricing Implements pricing. */
    export function calculate(): number {
      return 1;
    }
  `;
}
