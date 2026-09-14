import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceInventory } from "../../../../packages/evidence/src/graph/EvidenceInventory";
import { EvidenceRustAdapter } from "../../../../packages/evidence/src/adapters/rust/EvidenceRustAdapter";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Attaches Rust doc comments and doc attributes while rejecting ordinary carriers. */
export async function test_rust_hosts(): Promise<void> {
  const inventory = await new EvidenceRustAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create("src/lib.rs", "pub mod api;\n"),
      TestSourceSnapshot.create(
        "src/api.rs",
        dedent`
          //! @evidence docs/requirements.md#module Implements the module.

          /**
           * @evidence docs/requirements.md#record Implements the record.
           */
          pub struct Record {
              /// @evidence docs/requirements.md#field Implements the field.
              pub value: i32,
          }

          #[doc = "@evidence docs/requirements.md#alias Implements the alias."]
          pub type Alias = Record;

          #[doc(hidden)]
          #[doc(alias = "HistoricalRecord")]
          pub struct RustdocMetadata;

          pub trait Service {
              /// @evidence docs/requirements.md#trait-method Implements the trait method.
              fn run(&self);
          }

          impl Record {
              /// @evidence docs/requirements.md#method Implements the method.
              pub fn calculate(&self) {}
          }

          // @evidence docs/requirements.md#ordinary Ordinary comments are unsupported.
          pub fn Ordinary() {}

          //// @evidence docs/requirements.md#four-slashes Four slashes are not Rust documentation.
          pub fn FourSlashes() {}

          pub fn Unsupported() {
              // @evidence docs/requirements.md#body Body comments are unsupported.
              let interpreted = "@evidence docs/requirements.md#string Interpreted strings are unsupported.";
              let raw = r#"@evidence docs/requirements.md#raw Raw strings are unsupported."#;
          }

          // @evidence docs/requirements.md#commented Commented declarations are unsupported.
          // pub fn Commented() {}
        `,
      ),
    ]),
  );

  // Every supported Rust documentation form creates an attached declaration.
  TestValidator.equals(
    "Rust attached declarations",
    inventory.declarations
      .map((declaration) => declaration.target)
      .sort(compare),
    [
      "docs/requirements.md#alias",
      "docs/requirements.md#field",
      "docs/requirements.md#method",
      "docs/requirements.md#module",
      "docs/requirements.md#record",
      "docs/requirements.md#trait-method",
    ],
  );

  // Ordinary comments, body comments, literals, and commented code stay visible.
  TestValidator.equals(
    "unsupported Rust annotation count",
    inventory.diagnostics.filter(
      (diagnostic) => diagnostic.code === "unsupported-annotation-host",
    ).length,
    5,
  );
  TestValidator.equals(
    "inert Rustdoc metadata",
    inventory.diagnostics.filter((diagnostic) =>
      diagnostic.code.startsWith("rust-"),
    ),
    [],
  );

  const withdrawn = await new EvidenceRustAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create("src/lib.rs", "pub mod hidden;\n"),
      TestSourceSnapshot.create(
        "src/hidden.rs",
        dedent`
          //! @internal This module and its public descendants are internal.

          pub struct Hidden {
              pub value: i32,
          }
        ` + "\n",
      ),
    ]),
  );
  const population = new EvidenceInventory([withdrawn]).select(
    withdrawn.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "withdrawn Rust module hierarchy",
    population.hidden.map((unit) => unit.identity.join(".")).sort(compare),
    ["hidden", "hidden.Hidden", "hidden.Hidden.value"],
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
