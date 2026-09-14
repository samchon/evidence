import {
  EvidenceLanguageRegistry,
  EvidenceRustAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Classifies Rust's public declaration and member matrix.
 *
 * Types, fields, variants, traits, values, and impl items retain exact public ownership.
 *
 * 1. Verify registered Rust metadata, then analyze public types, fields, variants,
 *    trait members, values, inherent members, and trait implementations.
 * 2. Require the exact public units and identities while excluding private and
 *    restricted declarations and preserving distinct associated-item ownership.
 */
export async function test_rust_units(): Promise<void> {
  // Certified metadata must accompany the pinned Rust grammar.
  const language = EvidenceLanguageRegistry.list().find(
    (entry) => entry.type === "rust",
  );
  if (language === undefined)
    throw new Error("Missing Rust language metadata.");
  TestValidator.equals(
    "certified Rust adapter",
    language.adapter?.entry,
    "EvidenceRustAdapter",
  );

  // Public source forms cover every shared symbol kind and explicit associated policy.
  const inventory = await new EvidenceRustAdapter().analyze(
    TestSourceSnapshot.create(
      "src/lib.rs",
      dedent`
        pub struct Sale<T> {
            pub amount: T,
            private: i32,
        }

        pub struct Pair(pub i32, i32);

        pub enum State {
            Ready,
            Failed { code: i32 },
        }

        pub trait Service {
            type Output;
            const LIMIT: usize;
            fn run(&self);
        }

        pub type Alias = Sale<i32>;
        pub fn calculate() {}
        pub const VERSION: usize = 1;
        pub static CURRENT: usize = 0;

        fn private_function() {}
        pub(crate) fn crate_function() {}

        impl<T> Sale<T> {
            pub fn total(&self) {}
            fn private_method(&self) {}
            pub const MAXIMUM: usize = 100;
        }

        impl<T> Sale<T> {
            pub fn discount(&self) {}
        }

        impl<T> Service for Sale<T> {
            type Output = T;
            const LIMIT: usize = 10;
            fn run(&self) {}
        }
      `,
    ),
  );

  // Restricted declarations and private fields or methods never enter the surface.
  TestValidator.equals("complete Rust units", inventory.diagnostics, []);
  TestValidator.equals(
    "Rust declaration units",
    inventory.units
      .map((unit) => `${unit.symbol}:${unit.identity.join(".")}`)
      .sort(compare),
    [
      "function:Service.run",
      "function:Sale.impl Service.run",
      "function:Sale.discount",
      "function:Sale.total",
      "function:calculate",
      "property:CURRENT",
      "property:Pair.0",
      "property:Sale.MAXIMUM",
      "property:Sale.amount",
      "property:Sale.impl Service.LIMIT",
      "property:Service.LIMIT",
      "property:State.Failed",
      "property:State.Ready",
      "property:VERSION",
      "type:Alias",
      "type:Pair",
      "type:Sale",
      "type:Sale.impl Service.Output",
      "type:Service",
      "type:Service.Output",
      "type:State",
    ].sort(compare),
  );
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
