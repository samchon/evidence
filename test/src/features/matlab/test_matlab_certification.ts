import { EvidenceAdapterCertification } from "../../internal/certification/EvidenceAdapterCertification";
import { EvidenceAdapterCertificationFixtures } from "../../internal/certification/EvidenceAdapterCertificationFixtures";

/**
 * Applies the shared adapter certification contract to MATLAB.
 *
 * The MATLAB fixture defines the expected inventory, graph failures, mutations,
 * and review fingerprint behavior independently of adapter implementation.
 *
 * 1. Construct the MATLAB certification fixture.
 * 2. Run the shared certification suite against its declared expectations.
 * 3. Require every inventory, graph, mutation, and fingerprint gate to pass.
 */
export async function test_matlab_certification(): Promise<void> {
  const fixture = EvidenceAdapterCertificationFixtures.all().find(
    (item) => item.type === "matlab",
  );
  if (fixture === undefined)
    throw new Error("MATLAB certification fixture is missing.");

  EvidenceAdapterCertification.assertInventory(
    fixture,
    await EvidenceAdapterCertification.analyze(fixture),
  );
  await EvidenceAdapterCertification.assertGraph(fixture);
  await EvidenceAdapterCertification.assertFailures(fixture);
  await EvidenceAdapterCertification.assertFingerprint(fixture);
  await EvidenceAdapterCertification.assertAmbiguity(fixture);
}
