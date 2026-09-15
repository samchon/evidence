import { EvidAdapterCertification } from "../../internal/certification/EvidAdapterCertification";
import { EvidAdapterCertificationFixtures } from "../../internal/certification/EvidAdapterCertificationFixtures";

/** Applies the shared adapter certification contract to MATLAB.
 *
 * The MATLAB fixture defines the expected inventory, graph failures, mutations, and review fingerprint behavior independently of adapter implementation.
 *
 * 1. Construct the MATLAB certification fixture.
 * 2. Run the shared certification suite against its declared expectations.
 * 3. Require every inventory, graph, mutation, and fingerprint gate to pass.
 */
export async function test_matlab_certification(): Promise<void> {
  const fixture = EvidAdapterCertificationFixtures.all().find(
    (item) => item.type === "matlab",
  );
  if (fixture === undefined)
    throw new Error("MATLAB certification fixture is missing.");

  EvidAdapterCertification.assertInventory(
    fixture,
    await EvidAdapterCertification.analyze(fixture),
  );
  await EvidAdapterCertification.assertGraph(fixture);
  await EvidAdapterCertification.assertFailures(fixture);
  await EvidAdapterCertification.assertFingerprint(fixture);
  await EvidAdapterCertification.assertAmbiguity(fixture);
}
