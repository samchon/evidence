import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Applies the shared adapter certification contract to Objective-C.
 *
 * The fixture fixes expected populations, mutations, graph failures, and stable review fingerprints.
 *
 * 1. Construct the Objective-C certification fixture.
 * 2. Run the shared certification suite.
 * 3. Require all declared gates to pass.
 */
export async function test_objc_certification(): Promise<void> {
  const fixture = AdapterCertificationFixtures.all().find(
    (item) => item.type === "objc",
  );
  if (fixture === undefined)
    throw new Error("Missing Objective-C certification fixture.");

  AdapterCertification.assertInventory(
    fixture,
    await AdapterCertification.analyze(fixture),
  );
  await AdapterCertification.assertGraph(fixture);
  await AdapterCertification.assertFailures(fixture);
  await AdapterCertification.assertFingerprint(fixture);
  await AdapterCertification.assertAmbiguity(fixture);
}
