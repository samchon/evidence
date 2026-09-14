import {
  EvidenceFingerprint,
  EvidenceInventory,
  EvidenceScalaAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps extension context semantic and suppresses withdrawn lexical export carriers without hiding source members. */
export async function test_scala_context(): Promise<void> {
  const adapter = new EvidenceScalaAdapter();
  const source = dedent`
    /** @evidence docs/spec.md#extension Supports both extensions. */
    extension (value: Int) {
      def first = 1
      def second = 2
    }
    object Source { val value = 1 }
    /** @internal Retired forwarding owner. */
    object Forward { export Source.value }
  `;
  const inventory = await adapter.analyze(
    TestSourceSnapshot.create("src/Context.scala", source),
  );
  TestValidator.equals(
    "extension and lexical withdrawals complete",
    inventory.diagnostics,
    [],
  );
  const first = inventory.units.find((unit) => unit.name === "first");
  if (first === undefined) throw new Error("Missing first extension method.");
  TestValidator.equals(
    "group Scaladoc attaches to each method",
    inventory.declarations.length,
    2,
  );
  const fingerprint = EvidenceFingerprint.inspect(
    inventory,
    first.id,
  ).fingerprint;
  const sibling = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/Context.scala",
      source.replace("second = 2", "second = 3"),
    ),
  );
  TestValidator.equals(
    "sibling body is outside method content",
    EvidenceFingerprint.inspect(sibling, first.id).fingerprint,
    fingerprint,
  );
  const receiver = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/Context.scala",
      source.replace("value: Int", "value: String"),
    ),
  );
  TestValidator.notEquals(
    "receiver change invalidates extension review",
    EvidenceFingerprint.inspect(receiver, first.id).fingerprint,
    fingerprint,
  );
  const graph = new EvidenceInventory([inventory]);
  const selected = inventory.units.map((unit) => unit.id);
  TestValidator.equals(
    "withdrawn export owner exposes no alias",
    graph.resolve(
      {
        file: "/project/src/Context.scala",
        segments: ["object Forward", "value"],
      },
      selected,
    ).status,
    "missing",
  );
  TestValidator.equals(
    "original source member remains visible",
    graph.resolve(
      {
        file: "/project/src/Context.scala",
        segments: ["object Source", "value"],
      },
      selected,
    ).status,
    "resolved",
  );
}
