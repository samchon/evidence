import { EvidenceFingerprint, EvidenceObjcAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps sibling declarators outside a cited unit's review fingerprint while retaining their own semantic changes. */
export async function test_objc_fingerprint_siblings(): Promise<void> {
  const source = dedent`
    @interface Contract {
      @public int first, second[1];
    }
    @property int primary, secondary;
    @end
    @implementation Contract
    @synthesize primary = _primary, secondary = _secondary;
    @end
    int run(void), other(int value);
  `;
  const adapter = new EvidenceObjcAdapter();
  const original = await adapter.analyze(
    TestSourceSnapshot.create("src/Contract.m", source),
  );
  const changed = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/Contract.m",
      source
        .replace("second[1]", "second[2]")
        .replace("_secondary", "_replacement")
        .replace("other(int value)", "other(long value)"),
    ),
  );

  TestValidator.equals(
    "original multi-declarator surface",
    original.diagnostics,
    [],
  );
  TestValidator.equals(
    "changed multi-declarator surface",
    changed.diagnostics,
    [],
  );
  for (const [stableName, changedName] of [
    ["ivar:first", "ivar:second"],
    ["primary", "secondary"],
    ["run", "other"],
  ] as const) {
    const stable = original.units.find((unit) => unit.name === stableName);
    const modified = original.units.find((unit) => unit.name === changedName);
    if (stable === undefined || modified === undefined)
      throw new Error("Missing sibling declaration.");
    TestValidator.equals(
      `${stableName} excludes sibling content`,
      EvidenceFingerprint.inspect(original, stable.id).fingerprint,
      EvidenceFingerprint.inspect(changed, stable.id).fingerprint,
    );
    TestValidator.notEquals(
      `${changedName} retains its own semantic edit`,
      EvidenceFingerprint.inspect(original, modified.id).fingerprint,
      EvidenceFingerprint.inspect(changed, modified.id).fingerprint,
    );
  }
}
