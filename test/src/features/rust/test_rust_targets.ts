import { EvidRustAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Resolves Rust public modules, aliases, fields, and associated items.
 *
 * Target resolution follows public files and preserves associated-item ownership.
 *
 * 1. Build a reference crate with module, declaration-file, alias, field, inherent,
 *    and trait-implementation access paths.
 * 2. Resolve corresponding evidence tags and require every target to resolve.
 * 3. Require aliases to share the Sale unit while colliding inherent and trait
 *    methods remain distinct units.
 */
export async function test_rust_targets(): Promise<void> {
  const adapter = new EvidRustAdapter();

  // The reference exposes one owner through its module path, declaration file, and alias.
  const reference = await adapter.analyze(
    EvidTestSourceSnapshot.combine([
      EvidTestSourceSnapshot.create(
        "src/lib.rs",
        dedent`
          pub mod sale;
          pub use sale::Sale as PublicSale;

          pub trait Service {
              fn run(&self);
          }
        `,
      ),
      EvidTestSourceSnapshot.create(
        "src/sale.rs",
        dedent`
          pub struct Sale {
              pub total: i32,
          }

          impl Sale {
              pub fn calculate(&self) {}
              pub fn run(&self) {}
          }

          impl crate::Service for Sale {
              fn run(&self) {}
          }
        `,
      ),
    ]),
  );
  const claim = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "test/sale_test.rs",
      dedent`
        /// @evidence ../src/lib.rs#sale.Sale Verifies the module path.
        /// @evidence ../src/lib.rs#PublicSale Verifies the public alias.
        /// @evidence ../src/sale.rs#Sale Verifies the declaration file.
        /// @evidence ../src/sale.rs#Sale.total Verifies the public field.
        /// @evidence ../src/lib.rs#PublicSale.total Verifies an alias-owned field.
        /// @evidence ../src/lib.rs#sale.Sale.calculate Verifies the inherent method.
        /// @evidence ../src/sale.rs#Sale.run Verifies the colliding inherent method.
        /// @evidence ../src/sale.rs#Sale["impl crate::Service"].run Verifies the trait method.
        pub fn verify() {}
      `,
    ),
  );

  TestValidator.equals(
    "complete Rust target reference",
    reference.diagnostics,
    [],
  );
  TestValidator.equals("complete Rust target claim", claim.diagnostics, []);
  const resolutions = await EvidTestGraph.resolveDeclarations(
    claim,
    reference,
    reference.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "resolved Rust targets",
    resolutions.map((resolution) => resolution.resolution.status),
    [
      "resolved",
      "resolved",
      "resolved",
      "resolved",
      "resolved",
      "resolved",
      "resolved",
      "resolved",
    ],
  );
  TestValidator.equals(
    "Rust Sale aliases resolve one identity",
    new Set(
      resolutions
        .flatMap((resolution) => resolution.resolution.units)
        .filter((unit) => unit.identity.join(".") === "sale.Sale")
        .map((unit) => unit.id),
    ).size,
    1,
  );
  TestValidator.equals(
    "Rust inherent and trait methods remain distinct",
    new Set(
      resolutions
        .flatMap((resolution) => resolution.resolution.units)
        .filter((unit) => unit.name === "run")
        .map((unit) => unit.id),
    ).size,
    2,
  );
}
