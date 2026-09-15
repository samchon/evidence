import { EvidAdapterCertification } from "../../internal/certification/EvidAdapterCertification";
import { EvidAdapterCertificationFixtures } from "../../internal/certification/EvidAdapterCertificationFixtures";

/**
 * Applies shared adapter certification to Swift.
 *
 * The Swift fixture defines inventory, graph, and fingerprint expectations.
 *
 * 1. Construct the fixture.
 * 2. Run every shared certification gate.
 */
export async function test_swift_certification(): Promise<void> {
  const fixture = EvidAdapterCertificationFixtures.all().find(
    (item) => item.type === "swift",
  );
  if (fixture === undefined)
    throw new Error("Swift certification fixture is missing.");

  EvidAdapterCertification.assertInventory(
    fixture,
    await EvidAdapterCertification.analyze(fixture),
  );
  await EvidAdapterCertification.assertGraph(fixture);
  await EvidAdapterCertification.assertFailures(fixture);
  await EvidAdapterCertification.assertFingerprint(fixture);
  await EvidAdapterCertification.assertAmbiguity(fixture);
}
