import { EvidenceAdapterCertification } from "../../internal/certification/EvidenceAdapterCertification";
import { EvidenceAdapterCertificationFixtures } from "../../internal/certification/EvidenceAdapterCertificationFixtures";

/**
 * Applies the shared adapter certification contract to Objective-C.
 *
 * The fixture fixes expected populations, mutations, graph failures, and stable
 * review fingerprints.
 *
 * 1. Construct the Objective-C certification fixture.
 * 2. Run the shared certification suite.
 * 3. Require all declared gates to pass.
 */
export async function test_objc_certification(): Promise<void> {
  const fixture = EvidenceAdapterCertificationFixtures.all().find(
    (item) => item.type === "objc",
  );
  if (fixture === undefined)
    throw new Error("Missing Objective-C certification fixture.");

  EvidenceAdapterCertification.assertInventory(
    fixture,
    await EvidenceAdapterCertification.analyze(fixture),
  );
  await EvidenceAdapterCertification.assertGraph(fixture);
  await EvidenceAdapterCertification.assertFailures(fixture);
  await EvidenceAdapterCertification.assertFingerprint(fixture);
  await EvidenceAdapterCertification.assertAmbiguity(fixture);
}
