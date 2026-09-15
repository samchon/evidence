import {
  EvidenceFingerprint,
  EvidenceInventory,
  EvidenceScalaAdapter,
} from "evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Resolves Scala exports while preserving source declaration ownership.
 *
 * A forwarding object exports an overloaded method, property, and type alias
 * from another selected source, with evidence on the forwarding export path.
 *
 * 1. Analyze the selected Scala sources and verify the exported alias resolves to
 *    its source unit without adding denominator units.
 * 2. Verify overload and export physical sites are retained and a source-body edit
 *    changes the exported fingerprint.
 * 3. Withdraw the source method and verify the exported alias resolves as hidden.
 */
export async function test_scala_exports(): Promise<void> {
  const sources = EvidenceTestSourceSnapshot.combine([
    EvidenceTestSourceSnapshot.create(
      "src/Forward.scala",
      dedent`
      package demo
      object Forward {
        /** @evidence docs/spec.md#run Publishes the operation. */
        export Origin.{run as call, value, Alias}
      }
    `,
    ),
    EvidenceTestSourceSnapshot.create(
      "src/Origin.scala",
      dedent`
      package demo
      object Origin {
        def run = 1
        def run(value: Int) = value
        val value = 1
        type Alias = Int
      }
    `,
    ),
  ]);
  const adapter = new EvidenceScalaAdapter();
  const inventory = await adapter.analyze(sources);
  TestValidator.equals("bounded exports complete", inventory.diagnostics, []);
  const graph = new EvidenceInventory([inventory]);
  const selected = inventory.units.map((unit) => unit.id);
  const alias = graph.resolve(
    {
      file: "/project/src/Forward.scala",
      segments: ["demo", "object Forward", "call"],
    },
    selected,
  );
  const original = graph.resolve(
    {
      file: "/project/src/Origin.scala",
      segments: ["demo", "object Origin", "run"],
    },
    selected,
  );
  TestValidator.equals("export alias resolves original unit", alias, original);
  TestValidator.equals(
    "export aliases do not duplicate denominator",
    inventory.units.length,
    5,
  );
  const run = inventory.units.find((unit) => unit.name === "run");
  if (run === undefined) throw new Error("Missing exported method.");
  TestValidator.equals(
    "overloads and export retain physical sites",
    run.sites.length,
    3,
  );
  const changed = structuredClone(sources);
  const source = changed.files[1];
  if (source === undefined) throw new Error("Missing origin source.");
  source.content = source.content.replace("def run = 1", "def run = 2");
  TestValidator.notEquals(
    "target edit invalidates exported fingerprint",
    EvidenceFingerprint.inspect(inventory, run.id).fingerprint,
    EvidenceFingerprint.inspect(await adapter.analyze(changed), run.id)
      .fingerprint,
  );
  const withdrawn = structuredClone(sources);
  const originalSource = withdrawn.files[1];
  if (originalSource === undefined) throw new Error("Missing source.");
  originalSource.content = originalSource.content.replace(
    "def run = 1",
    "/** @internal Retired method. */\ndef run = 1",
  );
  const hidden = await adapter.analyze(withdrawn);
  TestValidator.equals(
    "source withdrawal crosses export aliases",
    new EvidenceInventory([hidden]).resolve(
      {
        file: "/project/src/Forward.scala",
        segments: ["demo", "object Forward", "call"],
      },
      hidden.units.map((unit) => unit.id),
    ).status,
    "hidden",
  );
}
