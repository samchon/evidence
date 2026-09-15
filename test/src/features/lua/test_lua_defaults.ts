import { EvidenceChecker, EvidenceConfigLoader } from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { join } from "node:path";

import { EvidenceTestFileSystem } from "../../internal/EvidenceTestFileSystem";

/**
 * Prevents Lua from passing through an empty default type selector.
 *
 * A language without type units must retain an explicit graph obligation
 * instead of treating an empty selector as coverage.
 *
 * 1. Configure a default type reference for Lua. 2. Run graph evaluation. 3.
 *    Require the empty selection to fail visibly.
 */
export async function test_lua_defaults(): Promise<void> {
  await EvidenceTestFileSystem.experiment(
    "lua-defaults",
    {
      "evidence.config.ts": dedent`
      export default { claims: [{ type: "typescript", files: ["claim.ts"], reference: { type: "lua", files: ["contract.lua"] } }] };
    `,
      "claim.ts": "export function claim() {}",
      "contract.lua": "function run() end\nvalue = 1",
    },
    async (directory) => {
      const file = join(directory, "evidence.config.ts");
      const missing = await EvidenceChecker.check(file);

      TestValidator.equals(
        "default reference includes real Lua declarations",
        missing.success,
        false,
      );
      await EvidenceTestFileSystem.save(directory, {
        "claim.ts": dedent`
      /**
       * @evidence ./contract.lua#run Covers the function.
       * @evidence ./contract.lua#value Covers the property.
       */
      export function claim() {}
    `,
      });
      TestValidator.equals(
        "covering default selectors passes",
        (await EvidenceChecker.check(file)).success,
        true,
      );
      for (const role of ["claim", "reference"] as const) {
        await EvidenceTestFileSystem.save(directory, {
          "evidence.config.ts":
            role === "claim"
              ? dedent`
        export default { claims: [{ type: "lua", files: ["contract.lua"], symbol: "type", reference: {type: "typescript", files: ["claim.ts"]} }] };
      `
              : dedent`
        export default { claims: [{ type: "typescript", files: ["claim.ts"], reference: {type: "lua", files: ["contract.lua"], symbol: "type"} }] };
      `,
        });
        await TestValidator.error(
          `unsupported ${role} selector rejected`,
          async () => EvidenceConfigLoader.load(file),
        );
      }
    },
  );
}
