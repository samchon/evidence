import { EvidenceFingerprint, EvidenceMatlabAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps each member fingerprint scoped to its own content and shared access metadata. */
export async function test_matlab_fingerprints(): Promise<void> {
  const content = dedent`
    classdef Contract
      properties (SetAccess=private)
        first = 1
        second = 2
      end
    end
  `.concat("\n");
  const adapter = new EvidenceMatlabAdapter();
  const original = await adapter.analyze(
    TestSourceSnapshot.create("src/Contract.m", content),
  );
  const sibling = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/Contract.m",
      content.replace("first = 1", "first = 7"),
    ),
  );
  const metadata = await adapter.analyze(
    TestSourceSnapshot.create(
      "src/Contract.m",
      content.replace("SetAccess=private", "SetAccess=public"),
    ),
  );
  const second = original.units.find((unit) => unit.name === "second");
  if (second === undefined) throw new Error("Missing selected property.");

  TestValidator.equals(
    "valid source ownership spans",
    original.diagnostics,
    [],
  );
  TestValidator.equals(
    "sibling does not change member fingerprint",
    EvidenceFingerprint.inspect(original, second.id).fingerprint,
    EvidenceFingerprint.inspect(sibling, second.id).fingerprint,
  );
  TestValidator.notEquals(
    "access metadata changes fingerprint",
    EvidenceFingerprint.inspect(original, second.id).fingerprint,
    EvidenceFingerprint.inspect(metadata, second.id).fingerprint,
  );
}
