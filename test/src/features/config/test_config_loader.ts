import { EvidenceConfigLoader } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { evaluateTypeScriptConfig } from "../../../../packages/evidence/src/internal/evaluateTypeScriptConfig";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Loads imported config data in isolation and propagates evaluator failures. */
export async function test_config_loader(): Promise<void> {
  // Resolve workspace peers while preserving spaces and literal path characters.
  const location = join(__dirname, `loader $' ${randomUUID()}`);
  const source = dedent`
    import { files } from "./helpers/files";
    import type { IEvidenceConfig } from "@wrtnlabs/evidence";

    export default {
      claims: [
        {
          type: "typescript",
          files,
          reference: { type: "markdown", files: ["docs/**"] },
        },
      ],
    } satisfies IEvidenceConfig;
  `;

  await TestFileSystem.experiment(
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
        await TestFileSystem.save(directory, { [filename]: source });

        const output = await EvidenceConfigLoader.load(
          join(directory, filename),
        );

        TestValidator.equals(
          `${extension} imported globs`,
          output.claims[0]?.files,
          ["src/**"],
        );
      }

      // Evaluator stdout and stderr share the diagnostic sink instead of process stdout.
      await TestFileSystem.save(directory, {
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
      await TestFileSystem.save(directory, {
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
        EvidenceConfigLoader.load(join(directory, "evidence.config.ts")),
      );

      TestValidator.predicate(
        "unsupported artifact path",
        unsupported.includes(
          "claims[0].type: artifact type 'graphql' has no certified Evidence adapter",
        ),
      );

      // A disabled population is validated and planned without touching its missing root.
      await TestFileSystem.save(directory, {
        "evidence.config.ts": dedent`
          import type { IEvidenceConfig } from "@wrtnlabs/evidence";

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
          } satisfies IEvidenceConfig;
        `,
      });

      const inactive = await EvidenceConfigLoader.plan(
        join(directory, "evidence.config.ts"),
      );

      TestValidator.equals(
        "configuration plan anchor",
        inactive.configFile,
        join(directory, "evidence.config.ts"),
      );
      TestValidator.equals("inactive populations", inactive.claims, []);

      // Runtime exceptions reject the loader promise instead of returning data.
      await TestFileSystem.save(directory, {
        "evidence.config.ts": dedent`
          throw new Error("Config failed during evaluation");
          export default {};
        `,
      });

      await TestValidator.error("runtime exception", () =>
        EvidenceConfigLoader.load(join(directory, "evidence.config.ts")),
      );

      // Imported type errors reach the caller through the evaluator failure.
      await TestFileSystem.save(directory, {
        "evidence.config.ts": source,
        "helpers/files.ts": dedent`
          export const files: string[] = [123];
        `,
      });

      await TestValidator.error("imported TypeScript error", () =>
        EvidenceConfigLoader.load(join(directory, "evidence.config.ts")),
      );
    },
  );
}

async function failure(closure: () => Promise<unknown>): Promise<string> {
  try {
    await closure();
  } catch (cause) {
    if (cause instanceof Error) return cause.message;
    throw cause;
  }
  throw new Error("Expected Evidence configuration loading to fail.");
}
