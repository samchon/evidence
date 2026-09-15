import { EvidenceFingerprint, EvidenceInventory, EvidenceObjcAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Merges Objective-C declaration sites without collapsing distinct members.
 *
 * Properties, getter selectors, synthesized content, and duplicate definitions
 * have different identity and completeness rules.
 *
 * 1. Analyze class interfaces and implementations with properties and accessors.
 * 2. Verify expected merged identities and independent selector addresses.
 * 3. Require conflicting duplicate definitions to remain incomplete.
 */
export async function test_objc_merges(): Promise<void> {
  const adapter = new EvidenceObjcAdapter();
  const header = EvidenceTestSourceSnapshot.create(
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
    EvidenceTestSourceSnapshot.combine([
      header,
      EvidenceTestSourceSnapshot.create("src/Contract.m", implementation),
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
    EvidenceTestSourceSnapshot.combine([
      header,
      EvidenceTestSourceSnapshot.create(
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
    EvidenceTestSourceSnapshot.combine([
      header,
      EvidenceTestSourceSnapshot.create(
        "src/First.m",
        "@implementation Contract\n+ (int)value { return 1; }\n@end\n",
      ),
      EvidenceTestSourceSnapshot.create(
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
  const duplicateProperty = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      header,
      EvidenceTestSourceSnapshot.create(
        "src/Duplicate.m",
        "@implementation Contract\n@synthesize stored = _first;\n@synthesize stored = _second;\n@end\n",
      ),
    ]),
  );
  TestValidator.equals(
    "duplicate property implementations are incomplete",
    duplicateProperty.complete,
    false,
  );
  TestValidator.equals(
    "property implementation conflict is retained",
    duplicateProperty.diagnostics.filter(
      (item) => item.code === "objc-definition-conflict",
    ).length,
    1,
  );

  const escaped = await adapter.analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "src/Escaped.h",
        "@interface \\u0057idget\n- (void)\\u0072un;\n@end\n",
      ),
      EvidenceTestSourceSnapshot.create(
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
    escaped.units
      .map(
        (unit) =>
          `${unit.symbol}:${unit.identity.join("/")}:${unit.sites.length}`,
      )
      .sort((left, right) => left.localeCompare(right)),
    ["function:Widget/-run:2", "type:Widget:2"],
  );
}
