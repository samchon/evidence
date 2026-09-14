import { EvidenceWatcher } from "@wrtnlabs/evidence";
import type { EvidenceWatchCycle } from "@wrtnlabs/evidence";
import { TestParserAssets } from "../../internal/TestParserAssets";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { TreeSitterAssets } from "../../../../packages/evidence/src/internal/TreeSitterAssets";
import { TreeSitterAssetScope } from "../../../../packages/evidence/src/internal/TreeSitterAssetScope";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** A failed parser download publishes an incomplete cycle and recovers automatically without any source edit. */
export async function test_watch_parser_recovery(): Promise<void> {
  const grammar = await new TreeSitterAssets().grammar("python");
  const configGrammar = await new TreeSitterAssets().grammar("typescript");
  const pinned = Uint8Array.from(await TestParserAssets.bytes(grammar));
  const configPinned = Uint8Array.from(
    await TestParserAssets.bytes(configGrammar),
  );
  await TestFileSystem.experiment(
    join(__dirname, `parser-recovery-${randomUUID()}`),
    {
      "project/evidence.config.ts": dedent`
        export default {
          claims: [{
            type: "python",
            files: ["api.py"],
            symbol: "function",
            reference: {
              type: "markdown",
              files: ["requirements.md"],
              symbol: "h2",
            },
          }],
        };
      `,
      "project/api.py": dedent`
      def run():
          """@evidence requirements.md#execute Execute the requirement."""
          return 1
    `,
      "project/requirements.md": "## Execute\nRun the operation.\n",
    },
    async (directory) => {
      const cycles: EvidenceWatchCycle[] = [];
      let available = false;
      let requests = 0;
      const watcher = new EvidenceWatcher(
        join(directory, "project", "evidence.config.ts"),
        {
          pollIntervalMilliseconds: 10,
          debounceMilliseconds: 0,
          parserRetryMilliseconds: 10,
        },
      );
      const timeout = setTimeout(() => {
        void watcher.close();
      }, 10_000);
      try {
        await TreeSitterAssetScope.run(
          {
            cacheDirectory: join(directory, "cache"),
            attempts: 1,
            fetch: async (input) => {
              if (String(input) === configGrammar.wasm.url)
                return new Response(configPinned);
              ++requests;
              if (!available) throw new Error("offline");
              return new Response(pinned);
            },
          },
          async () =>
            watcher.watch(async (cycle) => {
              cycles.push(cycle);
              if (cycle.cycle === 1) available = true;
              else await watcher.close();
            }),
        );
      } finally {
        clearTimeout(timeout);
        await watcher.close();
      }

      TestValidator.equals(
        "failed preparation remains incomplete",
        cycles[0]?.status,
        "incomplete",
      );
      TestValidator.equals(
        "failed preparation exits operationally",
        cycles[0]?.exitCode,
        2,
      );
      TestValidator.equals(
        "unmodified source recovers",
        cycles[1]?.success,
        true,
      );
      TestValidator.equals(
        "one failed transfer and one successful retry",
        requests,
        2,
      );
    },
  );
}
