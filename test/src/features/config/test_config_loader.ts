import { evaluateTypeScriptConfig, EvidConfigLoader } from "evid";
import type { IEvidConfig } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { EvidTestFileSystem } from "../../internal/EvidTestFileSystem";

/**
 * Loads TypeScript configuration dependencies in isolation and preserves
 * failures.
 *
 * Configuration evaluation must follow imported modules without checking
 * unrelated workspace files or leaking configuration logs into report stdout.
 * Validation still applies to artifact contracts before inactive populations
 * are filtered.
 *
 * 1. Use a path containing spaces and literal punctuation; load equivalent ts,
 *    cts, and mts configurations that import helper globs while an unrelated
 *    TypeScript file contains a type error.
 * 2. Remove the consumer tsconfig and require the isolated evaluator to load the
 *    same TypeScript configuration and its imported helper.
 * 3. Emit stdout and stderr from configuration evaluation and require both tokens
 *    to reach the supplied diagnostic sink.
 * 4. Configure an unsupported artifact and require its exact claims[0].type path
 *    and adapter-certification cause in the loading error.
 * 5. Plan a disabled claim with missing source and reference paths; require the
 *    correct configuration anchor and no active claims without touching those
 *    inputs.
 * 6. Require runtime exceptions and type errors in an imported helper to reject
 *    loading rather than return partial configuration data.
 */
export async function test_config_loader(): Promise<void> {
  // Resolve workspace peers while preserving spaces and literal path characters.
  const location = join(__dirname, `loader $' ${randomUUID()}`);
  const source = dedent`
    import { files } from "./helpers/files";
    import type { IEvidConfig } from "evid";

    export default {
      claims: [
        {
          type: "typescript",
          files,
          reference: { type: "markdown", files: ["docs/**"] },
        },
      ],
    } satisfies IEvidConfig;
  `;

  await EvidTestFileSystem.experiment(
    location,
    {
      "helpers/files.ts": dedent`
        export const files = ["src/**"];
      `,
      "unrelated.ts": dedent`
        const invalid: number = "unrelated";
      `,
      "tsconfig.json": JSON.stringify({
        compilerOptions: { noEmit: true },
        include: ["**/*.ts"],
      }),
    },
    async (directory) => {
      // All module extensions load imports without checking the unrelated source.
      for (const extension of ["ts", "cts", "mts"]) {
        const filename = `evidence.config.${extension}`;
        await EvidTestFileSystem.save(directory, { [filename]: source });

        const output = await EvidConfigLoader.load(join(directory, filename));

        TestValidator.equals(
          `${extension} imported globs`,
          output.claims[0]?.files,
          ["src/**"],
        );
      }

      // The evaluator supplies its own compiler project after resolving consumer dependencies.
      await rm(join(directory, "tsconfig.json"));
      const isolated: IEvidConfig = await EvidConfigLoader.load(
        join(directory, "evidence.config.ts"),
      );
      TestValidator.equals(
        "config without tsconfig",
        isolated.claims[0]?.files,
        ["src/**"],
      );

      // Evaluator stdout and stderr share the diagnostic sink instead of process stdout.
      await EvidTestFileSystem.save(directory, {
        "evidence.config.ts": dedent`
          console.log("config-output-token");
          console.error("config-error-token");
          export default { claims: [] };
        `,
      });
      const diagnostics: string[] = [];
      function writeDiagnostic(content: string): void {
        diagnostics.push(content);
      }

      await evaluateTypeScriptConfig(join(directory, "evidence.config.ts"), {
        writeDiagnostic,
      });

      const diagnosticOutput = diagnostics.join("");
      TestValidator.predicate(
        "config stdout isolation",
        diagnosticOutput.includes("config-output-token"),
      );
      TestValidator.predicate(
        "config stderr preservation",
        diagnosticOutput.includes("config-error-token"),
      );

      // Unsupported artifact identifiers fail with their exact configuration path.
      await EvidTestFileSystem.save(directory, {
        "evidence.config.ts": dedent`
          export default {
            claims: [
              {
                type: "graphql",
                files: ["schema/**"],
                reference: { type: "markdown", files: ["docs/**"] },
              },
            ],
          };
        `,
      });
      const unsupported = await failure(() =>
        EvidConfigLoader.load(join(directory, "evidence.config.ts")),
      );

      TestValidator.predicate(
        "unsupported artifact path",
        unsupported.includes(
          "claims[0].type: artifact type 'graphql' has no certified Evid adapter",
        ),
      );

      // A disabled population is validated and planned without touching its missing root.
      await EvidTestFileSystem.save(directory, {
        "evidence.config.ts": dedent`
          import type { IEvidConfig } from "evid";

          export default {
            claims: [
              {
                type: "typescript",
                disabled: true,
                root: "missing-source",
                files: ["**/*.ts"],
                reference: {
                  type: "swagger",
                  file: "missing-openapi.json",
                },
              },
            ],
          } satisfies IEvidConfig;
        `,
      });

      const inactive = await EvidConfigLoader.plan(
        join(directory, "evidence.config.ts"),
      );

      TestValidator.equals(
        "configuration plan anchor",
        inactive.configFile,
        join(directory, "evidence.config.ts"),
      );
      TestValidator.equals("inactive populations", inactive.claims, []);

      // Runtime exceptions reject the loader promise instead of returning data.
      await EvidTestFileSystem.save(directory, {
        "evidence.config.ts": dedent`
          throw new Error("Config failed during evaluation");
          export default {};
        `,
      });

      await TestValidator.error("runtime exception", () =>
        EvidConfigLoader.load(join(directory, "evidence.config.ts")),
      );

      // Imported type errors reach the caller through the evaluator failure.
      await EvidTestFileSystem.save(directory, {
        "evidence.config.ts": source,
        "helpers/files.ts": dedent`
          export const files: string[] = [123];
        `,
      });

      await TestValidator.error("imported TypeScript error", () =>
        EvidConfigLoader.load(join(directory, "evidence.config.ts")),
      );
    },
  );
}

/**
 * Captures a loading error for assertions about its configuration coordinates.
 *
 * Unexpected success fails the scenario, and non-Error rejections are
 * propagated so they cannot be mistaken for the diagnostic message under test.
 */
async function failure(closure: () => Promise<unknown>): Promise<string> {
  try {
    await closure();
  } catch (cause) {
    if (cause instanceof Error) return cause.message;
    throw cause;
  }
  throw new Error("Expected Evid configuration loading to fail.");
}
