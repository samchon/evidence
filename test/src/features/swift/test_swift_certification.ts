import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Applies shared adapter certification to Swift.
 *
 * The Swift fixture defines inventory, graph, and fingerprint expectations.
 *
 * 1. Construct the fixture.
 * 2. Run every shared certification gate.
 */
export async function test_swift_certification(): Promise<void> {
  const fixture = AdapterCertificationFixtures.all().find(
    (item) => item.type === "swift",
  );
  if (fixture === undefined)
    throw new Error("Swift certification fixture is missing.");

  AdapterCertification.assertInventory(
    fixture,
    await AdapterCertification.analyze(fixture),
  );
  await AdapterCertification.assertGraph(fixture);
  await AdapterCertification.assertFailures(fixture);
  await AdapterCertification.assertFingerprint(fixture);
  await AdapterCertification.assertAmbiguity(fixture);
}
