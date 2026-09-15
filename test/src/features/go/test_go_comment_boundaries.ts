import { EvidFingerprint, EvidGoAdapter, EvidInventory } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Separates trailing Go comments from leading documentation runs.
 *
 * Evid attaches only to the declaration-leading run despite matching columns.
 *
 * 1. Analyze leading and trailing annotated comments.
 * 2. Compare attached declarations.
 * 3. Require trailing annotations to remain inert.
 */
export async function test_go_comment_boundaries(): Promise<void> {
  const source = dedent`
    package sale
    var Before = 1 // @evidence docs/spec.md#trailing Cannot document After.
                   // 한글 🐹
                   // @evidence docs/spec.md#after Documents After itself.
                   var After = 2
    var Earlier = 3 /* @evidenceReview docs/spec.md#review Cannot review Later. */
                    var Later = 4
  `;
  const adapter = new EvidGoAdapter();
  for (const content of [source, source.replaceAll("\n", "\r\n")]) {
    const inventory = await adapter.analyze(
      EvidTestSourceSnapshot.create("sale/values.go", content),
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
      "only the standalone run attaches",
      inventory.declarations.map((item) => ({
        target: item.target,
        owners: hosts.get(item.hostId),
      })),
      [{ target: "docs/spec.md#after", owners: ["After"] }],
    );
    TestValidator.equals(
      "trailing review cannot attach",
      inventory.reviews,
      [],
    );
    TestValidator.equals(
      "both trailing annotations diagnose",
      inventory.diagnostics.map((item) => item.code),
      ["unsupported-annotation-host", "unsupported-annotation-host"],
    );
    TestValidator.equals(
      "leading tag coordinates",
      inventory.declarations[0]?.location?.range?.start?.offset,
      content.indexOf("@evidence docs/spec.md#after"),
    );
    const rewritten = await adapter.analyze(
      EvidTestSourceSnapshot.create(
        "sale/values.go",
        content.replace(
          "Documents After itself.",
          "Records the same After contract.",
        ),
      ),
    );
    const after = inventory.units.find((unit) => unit.name === "After");
    if (after === undefined) throw new Error("Missing After.");
    TestValidator.equals(
      "leading metadata does not move fingerprints",
      EvidFingerprint.inspect(inventory, after.id).fingerprint,
      EvidFingerprint.inspect(rewritten, after.id).fingerprint,
    );
  }

  // A trailing withdrawal must not hide the following public declaration.
  const withdrawal = await adapter.analyze(
    EvidTestSourceSnapshot.create(
      "sale/values.go",
      "package sale\nvar Before = 1 // @internal Cannot withdraw After.\n               var After = 2\n",
    ),
  );
  TestValidator.equals(
    "trailing withdrawal hides no units",
    new EvidInventory([withdrawal]).select(
      withdrawal.units.map((unit) => unit.id),
    ).hidden,
    [],
  );

  // Standalone block documentation still attaches, and a blank line still separates a run.
  for (const gap of ["\n", "\n\n"]) {
    const inventory = await adapter.analyze(
      EvidTestSourceSnapshot.create(
        "sale/values.go",
        `package sale\n/* @evidence docs/spec.md#block Documents the block. */${gap}var Value = 1\n`,
      ),
    );
    TestValidator.equals(
      "block adjacency",
      inventory.declarations.length,
      gap === "\n" ? 1 : 0,
    );
    TestValidator.equals(
      "detached block is diagnosed",
      inventory.diagnostics.length,
      gap === "\n" ? 0 : 1,
    );
  }
}
