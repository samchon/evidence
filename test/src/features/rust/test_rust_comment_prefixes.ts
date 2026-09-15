import {
  EvidFingerprint,
  EvidInventory,
  EvidRustAdapter,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps Rust outer attributes attached across whitespace comments.
 *
 * Intervening comments cannot become evidence merely because they precede an attribute.
 *
 * 1. Analyze outer documentation, attributes, and ordinary comments separated by
 *    whitespace before one public item.
 * 2. Require only the documentation carrier to attach, ordinary tagged comments
 *    to remain unsupported, and content edits to affect the intended fingerprints.
 */
export async function test_rust_comment_prefixes(): Promise<void> {
  const source = dedent`
    /// 계약 🦀
    /// @evid docs/spec.md#type Implements the type.
    // Ordinary whitespace between the documentation and the declaration.
    #[deprecated]
    /* Another whitespace comment. */
    pub struct Sale {
      #[doc = "@evid docs/spec.md#field Implements the field."]
      // @evid docs/spec.md#unsupported This ordinary comment is unsupported.
      pub title: i32,
    }
    /// @internal Withdraws the nested owner.
    // Whitespace cannot cancel a withdrawal.
    pub mod hidden {
      pub struct Child;
    }
    pub mod container {
      //! @evid docs/spec.md#module Documents the module itself.
      // Inner documentation must never move to the following child.
      pub struct Child;
    }
  `;
  const adapter = new EvidRustAdapter();
  for (const content of [source, source.replaceAll("\n", "\r\n")]) {
    const inventory = await adapter.analyze(
      TestSourceSnapshot.create("src/lib.rs", content),
    );
    const units = new Map(
      inventory.units.map((unit) => [unit.id, unit.identity.join(".")]),
    );
    const hosts = new Map(
      inventory.hosts.map((host) => [
        host.id,
        host.unitIds.map((id) => units.get(id)),
      ]),
    );

    TestValidator.equals(
      "outer and inner documentation owners",
      inventory.declarations
        .map((item) => ({
          target: item.target,
          owners: hosts.get(item.hostId),
        }))
        .sort((a, b) => a.target.localeCompare(b.target)),
      [
        { target: "docs/spec.md#field", owners: ["Sale.title"] },
        { target: "docs/spec.md#module", owners: ["container"] },
        { target: "docs/spec.md#type", owners: ["Sale"] },
      ],
    );
    TestValidator.equals(
      "ordinary annotation stays unsupported",
      inventory.diagnostics.map((item) => item.code),
      ["unsupported-annotation-host"],
    );
    TestValidator.equals(
      "withdrawal crosses ordinary comments",
      new EvidInventory([inventory])
        .select(inventory.units.map((unit) => unit.id))
        .hidden.map((unit) => unit.identity.join("."))
        .sort((a, b) => a.localeCompare(b)),
      ["hidden", "hidden.Child"],
    );
    for (const item of inventory.declarations)
      TestValidator.equals(
        "original tag offset",
        item.location.range?.start?.offset,
        content.indexOf(`@evid ${item.target}`),
      );

    const edited = await adapter.analyze(
      TestSourceSnapshot.create(
        "src/lib.rs",
        content.replace(
          "Implements the field.",
          "Records the same field contract.",
        ),
      ),
    );
    const changed = await adapter.analyze(
      TestSourceSnapshot.create(
        "src/lib.rs",
        content.replace("#[deprecated]", "#[must_use]"),
      ),
    );
    const sale = inventory.units.find((unit) => unit.name === "Sale");
    if (sale === undefined) throw new Error("Missing Sale.");
    TestValidator.equals(
      "annotation changes preserve ancestor reviews",
      EvidFingerprint.inspect(inventory, sale.id).fingerprint,
      EvidFingerprint.inspect(edited, sale.id).fingerprint,
    );
    TestValidator.notEquals(
      "attributes remain semantic content",
      EvidFingerprint.inspect(inventory, sale.id).fingerprint,
      EvidFingerprint.inspect(changed, sale.id).fingerprint,
    );
  }

  // A comment cannot hide a conditional or expanding attribute from completeness checks.
  for (const attribute of [
    'cfg(feature = "optional")',
    'cfg_attr(feature = "optional", deprecated)',
    "custom_macro",
  ]) {
    const inventory = await adapter.analyze(
      TestSourceSnapshot.create(
        "src/lib.rs",
        `#[${attribute}]\n// whitespace\npub struct Conditional;\n`,
      ),
    );
    TestValidator.equals(
      "uncertain source stays incomplete",
      inventory.complete,
      false,
    );
    TestValidator.equals(
      "attribute failure is retained",
      inventory.diagnostics.some(
        (item) =>
          item.code ===
          (attribute.startsWith("cfg")
            ? "rust-conditional-item"
            : "rust-attribute-expansion"),
      ),
      true,
    );
  }
}
