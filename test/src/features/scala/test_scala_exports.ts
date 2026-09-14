import {
  EvidenceFingerprint,
  EvidenceInventory,
  EvidenceScalaAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Resolves explicit exports across selected sources while preserving source ownership and review content. */
export async function test_scala_exports(): Promise<void> {
  const sources = TestSourceSnapshot.combine([
    TestSourceSnapshot.create(
      "src/Forward.scala",
      dedent`
      package demo
      object Forward {
        /** @evidence docs/spec.md#run Publishes the operation. */
        export Origin.{run as call, value, Alias}
      }
    `,
    ),
    TestSourceSnapshot.create(
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
