import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceRustAdapter } from "../../../../packages/evidence/src/adapters/rust/EvidenceRustAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Reports Rust module, reexport, impl, conditional, macro, and parse uncertainty. */
export async function test_rust_failures(): Promise<void> {
  const adapter = new EvidenceRustAdapter();

  // File modules must have exactly one selected conventional source.
  const missing = await adapter.analyze(
    TestSourceSnapshot.create("src/lib.rs", "pub mod missing;\n"),
  );
  TestValidator.equals("missing Rust module", missing.complete, false);
  TestValidator.equals(
    "missing Rust module diagnostic",
    hasCode(missing, "rust-module-missing"),
    true,
  );

  const ambiguousModule = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create("src/lib.rs", "pub mod sale;\n"),
      TestSourceSnapshot.create("src/sale.rs", "pub struct Flat;\n"),
      TestSourceSnapshot.create("src/sale/mod.rs", "pub struct Nested;\n"),
    ]),
  );
  TestValidator.equals(
    "ambiguous Rust module",
    ambiguousModule.complete,
    false,
  );
  TestValidator.equals(
    "ambiguous Rust module diagnostic",
    hasCode(ambiguousModule, "rust-module-ambiguous"),
    true,
  );

  // Path overrides are explicit unsupported module ownership, even if selected.
  const overridden = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/lib.rs",
        dedent`
          #[path = "generated.rs"]
          pub mod api;
        `,
      ),
      TestSourceSnapshot.create("src/generated.rs", "pub struct Api;\n"),
    ]),
  );
  TestValidator.equals("Rust path override", overridden.complete, false);
  TestValidator.equals(
    "Rust path override diagnostic",
    hasCode(overridden, "rust-module-path"),
    true,
  );

  // Conditional declarations and members cannot be treated as one certain API.
  const conditional = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/lib.rs",
      dedent`
        #[cfg(feature = "conditional")]
        pub struct Conditional;

        pub trait Service {
            #[cfg(feature = "method")]
            fn run(&self);
        }
      `,
    ),
  );
  TestValidator.equals("conditional Rust API", conditional.complete, false);
  TestValidator.equals(
    "conditional Rust item diagnostics",
    conditional.diagnostics.filter(
      (diagnostic) => diagnostic.code === "rust-conditional-item",
    ).length,
    2,
  );

  const conditionalTuple = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/lib.rs",
      dedent`
        pub struct Pair(
            #[cfg(feature = "field")]
            pub i32,
        );
      `,
    ),
  );
  TestValidator.equals(
    "conditional Rust tuple field",
    conditionalTuple.complete,
    false,
  );
  TestValidator.equals(
    "conditional Rust tuple field diagnostic",
    hasCode(conditionalTuple, "rust-conditional-item"),
    true,
  );

  const dynamicDocumentation = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/lib.rs",
      dedent`
        #[doc = include_str!("service.md")]
        pub struct Service;
      `,
    ),
  );
  TestValidator.equals(
    "dynamic Rust documentation",
    dynamicDocumentation.complete,
    false,
  );
  TestValidator.equals(
    "dynamic Rust documentation diagnostic",
    hasCode(dynamicDocumentation, "rust-doc-attribute"),
    true,
  );

  // Item macros can add declarations; a macro invocation inside a body cannot.
  const macros = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/lib.rs",
      dedent`
        make_items!();

        #[macro_export]
        macro_rules! exported {
            () => {};
        }

        pub fn body_macro() {
            format!("{}", 1);
        }
      `,
    ),
  );
  TestValidator.equals("Rust macro boundary", macros.complete, false);
  TestValidator.equals(
    "Rust item macro diagnostic",
    hasCode(macros, "rust-item-macro"),
    true,
  );
  TestValidator.equals(
    "Rust exported macro diagnostic",
    hasCode(macros, "rust-public-macro"),
    true,
  );
  TestValidator.equals(
    "Rust body macro remains classified",
    macros.units.some((unit) => unit.name === "body_macro"),
    true,
  );

  // Blanket and external owners have no single selected nominal identity.
  const blanket = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/lib.rs",
      dedent`
        pub trait Service {
            fn run(&self);
        }

        impl<T> Service for T {
            fn run(&self) {}
        }
      `,
    ),
  );
  TestValidator.equals("Rust blanket impl", blanket.complete, false);
  TestValidator.equals(
    "Rust blanket impl diagnostic",
    hasCode(blanket, "rust-impl-owner"),
    true,
  );

  const externalOwner = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/lib.rs",
      dedent`
        impl remote::Sale {
            pub fn calculate(&self) {}
        }
      `,
    ),
  );
  TestValidator.equals(
    "Rust external impl owner",
    externalOwner.complete,
    false,
  );
  TestValidator.equals(
    "Rust external impl diagnostic",
    hasCode(externalOwner, "rust-impl-owner"),
    true,
  );

  const duplicateMember = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/lib.rs",
      dedent`
        pub struct Sale;

        impl Sale {
            pub fn calculate(&self) {}
        }

        impl Sale {
            pub fn calculate(&self) {}
        }
      `,
    ),
  );
  TestValidator.equals(
    "duplicate Rust associated item",
    duplicateMember.complete,
    false,
  );
  TestValidator.equals(
    "duplicate Rust associated item diagnostic",
    hasCode(duplicateMember, "rust-declaration-conflict"),
    true,
  );

  // Competing wildcard exports and recursive module aliases stay incomplete.
  const ambiguousExport = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/lib.rs",
      dedent`
        mod first {
            pub struct Item;
        }
        mod second {
            pub struct Item;
        }

        pub use first::*;
        pub use second::*;
      `,
    ),
  );
  TestValidator.equals(
    "ambiguous Rust export",
    ambiguousExport.complete,
    false,
  );
  TestValidator.equals(
    "ambiguous Rust export diagnostic",
    hasCode(ambiguousExport, "rust-export-ambiguity"),
    true,
  );

  const recursiveExport = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/lib.rs",
      dedent`
        pub mod recursive {
            pub use crate::recursive as again;
        }
      `,
    ),
  );
  TestValidator.equals(
    "recursive Rust export",
    recursiveExport.complete,
    false,
  );
  TestValidator.equals(
    "recursive Rust export diagnostic",
    hasCode(recursiveExport, "rust-reexport-cycle"),
    true,
  );

  // Tree-sitter syntax errors never become a healthy empty inventory.
  const malformed = await adapter.analyze(
    TestSourceSnapshot.create("src/lib.rs", "pub fn broken( {\n"),
  );
  TestValidator.equals("malformed Rust source", malformed.complete, false);
  TestValidator.equals(
    "Rust parse diagnostic",
    malformed.diagnostics.some((diagnostic) =>
      diagnostic.code.startsWith("rust-parse-"),
    ),
    true,
  );
}

function hasCode(inventory: IEvidenceInventory, code: string): boolean {
  return inventory.diagnostics.some((diagnostic) => diagnostic.code === code);
}
