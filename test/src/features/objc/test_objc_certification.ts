import { EvidAdapterCertification } from "../../internal/certification/EvidAdapterCertification";
import { EvidAdapterCertificationFixtures } from "../../internal/certification/EvidAdapterCertificationFixtures";

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
  const fixture = EvidAdapterCertificationFixtures.all().find(
    (item) => item.type === "objc",
  );
  if (fixture === undefined)
    throw new Error("Missing Objective-C certification fixture.");

  EvidAdapterCertification.assertInventory(
    fixture,
    await EvidAdapterCertification.analyze(fixture),
  );
  await EvidAdapterCertification.assertGraph(fixture);
  await EvidAdapterCertification.assertFailures(fixture);
  await EvidAdapterCertification.assertFingerprint(fixture);
  await EvidAdapterCertification.assertAmbiguity(fixture);
}
