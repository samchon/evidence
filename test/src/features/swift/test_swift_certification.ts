import { EvidenceAdapterCertification } from "../../internal/certification/EvidenceAdapterCertification";
import { EvidenceAdapterCertificationFixtures } from "../../internal/certification/EvidenceAdapterCertificationFixtures";

/**
 * Applies shared adapter certification to Swift.
 *
 * The Swift fixture defines inventory, graph, and fingerprint expectations.
 *
 * 1. Construct the fixture.
 * 2. Run every shared certification gate.
 */
export async function test_swift_certification(): Promise<void> {
  const fixture = EvidenceAdapterCertificationFixtures.all().find(
    (item) => item.type === "swift",
  );
  if (fixture === undefined)
    throw new Error("Swift certification fixture is missing.");

  EvidenceAdapterCertification.assertInventory(
    fixture,
    await EvidenceAdapterCertification.analyze(fixture),
  );
  await EvidenceAdapterCertification.assertGraph(fixture);
  await EvidenceAdapterCertification.assertFailures(fixture);
  await EvidenceAdapterCertification.assertFingerprint(fixture);
  await EvidenceAdapterCertification.assertAmbiguity(fixture);
}
