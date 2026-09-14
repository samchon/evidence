import { EvidenceRustAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Resolves Rust public modules, aliases, fields, and associated items.
 *
 * Target resolution follows public files and preserves associated-item ownership.
 *
 * 1. Resolve every supported Rust target form.
 * 2. Verify exact statuses and addresses.
 */
export async function test_rust_targets(): Promise<void> {
  const adapter = new EvidenceRustAdapter();

  // The reference exposes one owner through its module path, declaration file, and alias.
  const reference = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/lib.rs",
        dedent`
          pub mod sale;
          pub use sale::Sale as PublicSale;

          pub trait Service {
              fn run(&self);
          }
        `,
      ),
      TestSourceSnapshot.create(
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
    TestSourceSnapshot.create(
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
  const resolutions = await TestGraph.resolveDeclarations(
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
