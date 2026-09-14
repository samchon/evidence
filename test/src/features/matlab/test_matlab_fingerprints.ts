import { EvidenceFingerprint, EvidenceMatlabAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Scopes MATLAB member fingerprints to their own content and relevant metadata.
 *
 * A review must survive edits to unrelated members while changes to a member or its shared access policy invalidate the affected fingerprint.
 *
 * 1. Analyze a class with independently documented members and access metadata.
 * 2. Compare fingerprints after unrelated and annotation-only edits.
 * 3. Require semantic member and access changes to invalidate the relevant review.
 */
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
