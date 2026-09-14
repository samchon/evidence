import {
  EvidenceFingerprint,
  EvidenceInventory,
  EvidenceObjcAdapter,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps class properties, getter selectors, synthesized content, and duplicate definitions distinct. */
export async function test_objc_merges(): Promise<void> {
  const adapter = new EvidenceObjcAdapter();
  const header = TestSourceSnapshot.create(
    "src/Contract.h",
    dedent`
    @interface Contract
    @property(class) int value;
    + (int)value;
    @property int stored;
    - (int):(int)x next:(int)y;
    @end
  `,
  );
  const implementation = dedent`
    @implementation Contract
    @dynamic(class) value;
    @synthesize stored = _stored;
    + (int)value { return 1; }
    - (int):(int)x next:(int)y { return x+y; }
    @end
  `;
  const original = await adapter.analyze(
    TestSourceSnapshot.combine([
      header,
      TestSourceSnapshot.create("src/Contract.m", implementation),
    ]),
  );

  TestValidator.equals(
    "complete explicit property implementation",
    original.diagnostics,
    [],
  );
  const graph = new EvidenceInventory([original]);
  const ids = original.units.map((unit) => unit.id);
  for (const segment of ["class:value", "+value", "stored", "-:next:"])
    TestValidator.equals(
      `unambiguous member ${segment}`,
      graph.resolve(
        { file: "/project/src/Contract.m", segments: ["Contract", segment] },
        ids,
      ).status,
      "resolved",
    );
  const stored = original.units.find((unit) => unit.name === "stored");
  if (stored === undefined) throw new Error("Missing explicit property.");
  TestValidator.equals(
    "synthesize joins declared property",
    stored.sites.length,
    2,
  );
  const changed = await adapter.analyze(
    TestSourceSnapshot.combine([
      header,
      TestSourceSnapshot.create(
        "src/Contract.m",
        implementation.replace("_stored", "_other"),
      ),
    ]),
  );
  TestValidator.notEquals(
    "backing implementation changes property fingerprint",
    EvidenceFingerprint.inspect(original, stored.id).fingerprint,
    EvidenceFingerprint.inspect(changed, stored.id).fingerprint,
  );

  const duplicate = await adapter.analyze(
    TestSourceSnapshot.combine([
      header,
      TestSourceSnapshot.create(
        "src/First.m",
        "@implementation Contract\n+ (int)value { return 1; }\n@end\n",
      ),
      TestSourceSnapshot.create(
        "src/Second.m",
        "@implementation Contract\n+ (int)value { return 2; }\n@end\n",
      ),
    ]),
  );
  TestValidator.equals(
    "duplicate implementations leave inventory incomplete",
    duplicate.complete,
    false,
  );
  TestValidator.equals(
    "nominal and method definitions conflict independently",
    duplicate.diagnostics.filter(
      (item) => item.code === "objc-definition-conflict",
    ).length,
    2,
  );

  const escaped = await adapter.analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/Escaped.h",
        "@interface \\u0057idget\n- (void)\\u0072un;\n@end\n",
      ),
      TestSourceSnapshot.create(
        "src/Escaped.m",
        "@implementation Widget\n- (void)run {}\n@end\n",
      ),
    ]),
  );
  TestValidator.equals(
    "universal character names merge with ordinary spelling",
    escaped.diagnostics,
    [],
  );
  TestValidator.equals(
    "decoded nominal and selector identities",
    escaped.units.map((unit) => [unit.identity, unit.sites.length]),
    [
      [["Widget"], 2],
      [["Widget", "-run"], 2],
    ],
  );
}
