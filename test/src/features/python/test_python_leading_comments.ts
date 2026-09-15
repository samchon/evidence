import { EvidInventory, EvidPythonAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Attaches leading comments to the first eligible Python class member.
 *
 * The nested-class fixture places evidence before members, decorators, and constructor fields while also withdrawing a member, so lexical ownership must survive parser block boundaries.
 *
 * 1. Analyze the nested class fixture with leading evidence comments.
 * 2. Verify evidence targets attach to the intended nested type, method, and constructor field rather than the enclosing class.
 * 3. Repeat the assertions for LF, CRLF, and tab-indented source, verifying withdrawal, completion, reviews, and original tag offsets.
 */
export async function test_python_leading_comments(): Promise<void> {
  const source = dedent`
    class Sale:
        # 상품 생성 계약.
        # @evidence docs/spec.md#create Defines creation.
        class Create:
            # 상품명 계약.
            # @evidence docs/spec.md#title Implements title.
            # @evidenceReview docs/spec.md#title #abcdef0 Checked title.
            title = ""

    class Methods:
        # @evidence docs/spec.md#method Implements creation.
        @staticmethod
        def create():
            return None

    class Instance:
        def __init__(self):
            # @evidence docs/spec.md#field Implements the instance field.
            self.title = ""

    class Hidden:
        # @internal Withdraws only the nested type.
        class Nested:
            title = ""
        visible = 1
  `;

  for (const content of [
    source,
    source.replaceAll("\n", "\r\n"),
    source.replaceAll("    ", "\t"),
  ]) {
    const inventory = await new EvidPythonAdapter().analyze(
      EvidTestSourceSnapshot.create("src/sale.py", content),
    );
    const units = new Map(
      inventory.units.map((unit) => [unit.id, unit.identity.join(".")]),
    );
    const hosts = new Map(inventory.hosts.map((host) => [host.id, host]));

    TestValidator.equals(
      "leading comment owners",
      inventory.declarations
        .map((declaration) => ({
          target: declaration.target,
          owners: (hosts.get(declaration.hostId)?.unitIds ?? []).map((id) =>
            units.get(id),
          ),
        }))
        .sort((left, right) => left.target.localeCompare(right.target)),
      [
        { target: "docs/spec.md#create", owners: ["Sale.Create"] },
        { target: "docs/spec.md#field", owners: ["Instance.prototype.title"] },
        { target: "docs/spec.md#method", owners: ["Methods.create"] },
        { target: "docs/spec.md#title", owners: ["Sale.Create.title"] },
      ],
    );
    TestValidator.equals("leading review count", inventory.reviews.length, 1);
    TestValidator.equals(
      "review and evidence share a host",
      inventory.reviews[0]?.hostId,
      inventory.declarations.find(
        (declaration) => declaration.target === "docs/spec.md#title",
      )?.hostId,
    );
    const population = new EvidInventory([inventory]).select(
      inventory.units.map((unit) => unit.id),
    );
    TestValidator.equals(
      "withdrawal remains on the nested owner",
      population.hidden
        .map((unit) => unit.identity.join("."))
        .sort((left, right) => left.localeCompare(right)),
      ["Hidden.Nested", "Hidden.Nested.title"],
    );
    TestValidator.equals(
      "leading comments are complete",
      inventory.diagnostics,
      [],
    );

    // Original source positions survive Unicode prose, CRLF, and tabs.
    for (const declaration of inventory.declarations) {
      const range = declaration.location.range;
      TestValidator.equals(
        "mapped tag offset",
        range === undefined ? undefined : range.start.offset,
        content.indexOf(`@evidence ${declaration.target}`),
      );
    }
  }
}
