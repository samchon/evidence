import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { EvidenceConfigLoader } from "../../../../packages/evidence/src/EvidenceConfigLoader";
import { TestFileSystem } from "../../internal/TestFileSystem";

/** Loads imported config data in isolation and propagates evaluator failures. */
export async function test_config_loader(): Promise<void> {
  // Resolve workspace peers while preserving Unicode, spaces, and literal path characters.
  const location = join(__dirname, `loader 한글 $' ${randomUUID()}`);
  const source = dedent`
    import { files } from "./helpers/files";
    import type { IEvidenceConfig } from "@samchon/evidence";

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
