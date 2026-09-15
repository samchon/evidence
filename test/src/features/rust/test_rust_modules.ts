import { EvidAccessor, EvidRustAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Resolves Rust inline and file modules through public visibility.
 *
 * Public reexports and module files determine the addressable module graph.
 *
 * 1. Analyze inline, conventional file, private, restricted, wildcard-reexported,
 *    aliased, and orphan selected modules.
 * 2. Require reachable units and every expected canonical or alias address.
 * 3. Repeat the module graph with linked physical files and require logical source
 *    addresses to preserve the same module identities.
 */
export async function test_rust_modules(): Promise<void> {
  // Inline, conventional, private, and orphan modules share one selected snapshot.
  const inventory = await new EvidRustAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/lib.rs",
        dedent`
          pub mod sale;
          mod hidden;

          pub use sale::{calculate as compute, Sale as PublicSale};
          pub use sale::details::*;
          pub use hidden::Secret as PublicSecret;

          pub(crate) mod restricted {
              pub struct CrateOnly;
          }

          pub mod inline {
              pub struct Visible;
              pub(crate) struct Restricted;
              struct Private;
          }
        `,
      ),
      TestSourceSnapshot.create(
        "src/sale.rs",
        dedent`
          pub mod details;

          pub struct Sale {
              pub total: i32,
              private: i32,
          }

          pub fn calculate() {}
          pub(crate) struct CrateOnly;
        `,
      ),
      TestSourceSnapshot.create(
        "src/sale/details.rs",
        dedent`
          pub struct Detail;
          pub(crate) struct Restricted;
        `,
      ),
      TestSourceSnapshot.create(
        "src/hidden.rs",
        dedent`
          pub struct Secret;
          pub(crate) struct CrateOnly;
        `,
      ),
      TestSourceSnapshot.create("tools.rs", "pub struct Tool;\n"),
    ]),
  );

  TestValidator.equals("complete Rust module graph", inventory.diagnostics, []);
  TestValidator.equals(
    "reachable Rust module units",
    inventory.units.map((unit) => unit.identity.join(".")).sort(compare),
    [
      "Tool",
      "hidden.Secret",
      "inline",
      "inline.Visible",
      "sale",
      "sale.Sale",
      "sale.Sale.total",
      "sale.calculate",
      "sale.details",
      "sale.details.Detail",
    ].sort(compare),
  );

  const sale = inventory.units.find(
    (unit) => unit.identity.join(".") === "sale.Sale",
  );
  if (sale === undefined) throw new Error("Missing reexported Rust Sale.");
  TestValidator.equals(
    "Rust public aliases preserve one semantic identity",
    inventory.addresses
      .filter((address) => address.unitId === sale.id)
      .map(
        (address) =>
          `${address.file}#${EvidAccessor.format(address.segments)}`,
      )
      .sort(compare),
    [
      "/project/src/lib.rs#PublicSale",
      "/project/src/lib.rs#sale.Sale",
      "/project/src/sale.rs#Sale",
    ],
  );

  const secret = inventory.units.find(
    (unit) => unit.identity.join(".") === "hidden.Secret",
  );
  if (secret === undefined)
    throw new Error("Missing Rust private-module reexport.");
  TestValidator.equals(
    "Rust private module public item addresses",
    inventory.addresses
      .filter((address) => address.unitId === secret.id)
      .map(
        (address) =>
          `${address.file}#${EvidAccessor.format(address.segments)}`,
      )
      .sort(compare),
    ["/project/src/hidden.rs#Secret", "/project/src/lib.rs#PublicSecret"],
  );

  const detail = inventory.units.find(
    (unit) => unit.identity.join(".") === "sale.details.Detail",
  );
  if (detail === undefined)
    throw new Error("Missing wildcard-exported Rust Detail.");
  TestValidator.equals(
    "Rust wildcard public addresses",
    inventory.addresses
      .filter((address) => address.unitId === detail.id)
      .map(
        (address) =>
          `${address.file}#${EvidAccessor.format(address.segments)}`,
      )
      .sort(compare),
    [
      "/project/src/lib.rs#Detail",
      "/project/src/lib.rs#sale.details.Detail",
      "/project/src/sale.rs#details.Detail",
      "/project/src/sale/details.rs#Detail",
    ],
  );

  // Logical source addresses retain module layout when physical files are linked elsewhere.
  const linked = await new EvidRustAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "physical/crate/lib.rs",
        "pub mod sale;\n",
        ["workspace/src/lib.rs"],
        "/volume",
      ),
      TestSourceSnapshot.create(
        "physical/modules/sale.rs",
        "pub struct Sale;\n",
        ["workspace/src/sale.rs"],
        "/volume",
      ),
    ]),
  );
  TestValidator.equals("linked Rust module graph", linked.diagnostics, []);
  TestValidator.equals(
    "linked Rust module identities",
    linked.units.map((unit) => unit.identity.join(".")).sort(compare),
    ["sale", "sale.Sale"],
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
