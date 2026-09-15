import { EvidPhpAdapter } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/** Attaches PHPDoc annotations to exact declaration hosts.
 *
 * PHPDoc may acknowledge its attached declaration, while strings, ordinary comments, and examples remain inert.
 *
 * 1. Analyze declarations with eligible and ineligible tag-shaped text.
 * 2. Verify exact host attachment and original coordinates.
 * 3. Require only eligible documentation to create acknowledgements.
 */
export async function test_php_hosts(): Promise<void> {
  const content = dedent`
    <?php
    // Unicode before the host: 😀 한글
    /**
     * Public contract.
     * <code>
     * @evidence ignored.md#html Example.
     * </code>
     * \`\`\`php
     * @evidence ignored.md#fence Fenced example.
     * \`\`\`
     *
     *     @evidence ignored.md#indent Indented example.
     *
     * @evidence requirement.md#contract Actual acknowledgement.
     */
    #[Deprecated]
    class Contract {
      /** @evidence requirement.md#values Shared property documentation. */
      public int $first = 1, $second = 2;
      /** @internal Retired subtree. */
      public function legacy() {}
      /** @evidence requirement.md#private Private annotation cannot attach. */
      private function hidden() {}
      public function ordinary() {
        // @evidence ignored.md#line Ordinary comment.
        return '@evidence ignored.md#string Inert literal.';
      }
    }
    /** @evidence requirement.md#detached Detached PHPDoc. */
    $local = 1;
    /** @hidden Hidden type subtree. */
    class Hidden { public function child() {} }
  `.replaceAll("\n", "\r\n");
  const inventory = await new EvidPhpAdapter().analyze(
    EvidTestSourceSnapshot.create("src/hosts.php", content),
  );

  TestValidator.equals(
    "actual attached acknowledgements",
    inventory.declarations
      .filter(
        (declaration) =>
          inventory.hosts.find((host) => host.id === declaration.hostId)
            ?.attachment === "attached",
      )
      .map((declaration) => declaration.target)
      .sort((a, b) => a.localeCompare(b)),
    ["requirement.md#contract", "requirement.md#values"],
  );
  TestValidator.equals(
    "private and detached annotations unsupported",
    inventory.hosts.filter((host) => host.attachment === "unsupported").length,
    2,
  );
  TestValidator.equals(
    "shared declaration host owns both properties",
    inventory.hosts.find((host) => host.unitIds.length === 2)?.unitIds?.length,
    2,
  );
  const host = inventory.hosts.find((item) =>
    item.unitIds.includes(
      inventory.units.find((unit) => unit.name === "Contract")?.id ?? "",
    ),
  );
  TestValidator.equals(
    "original UTF-16 host start",
    host?.range?.start?.offset,
    content.indexOf("/**"),
  );
  TestValidator.equals("original line and column", host?.range?.start?.line, 3);
  TestValidator.equals(
    "withdrawn method has no eligible host",
    inventory.hosts.some((item) =>
      item.unitIds.includes(
        inventory.units.find((unit) => unit.name === "legacy")?.id ?? "",
      ),
    ),
    false,
  );
  TestValidator.equals(
    "withdrawn type removes descendant hosts",
    inventory.hosts.some((item) =>
      item.unitIds.includes(
        inventory.units.find((unit) => unit.name === "child")?.id ?? "",
      ),
    ),
    false,
  );
}
