import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Applies the shared adapter certification contract to MATLAB.
 *
 * The MATLAB fixture defines the expected inventory, graph failures, mutations, and review fingerprint behavior independently of adapter implementation.
 *
 * 1. Construct the MATLAB certification fixture.
 * 2. Run the shared certification suite against its declared expectations.
 * 3. Require every inventory, graph, mutation, and fingerprint gate to pass.
 */
export async function test_matlab_certification(): Promise<void> {
  const fixture = AdapterCertificationFixtures.all().find(
    (item) => item.type === "matlab",
  );
  if (fixture === undefined)
    throw new Error("MATLAB certification fixture is missing.");

  AdapterCertification.assertInventory(
    fixture,
    await AdapterCertification.analyze(fixture),
  );
  await AdapterCertification.assertGraph(fixture);
  await AdapterCertification.assertFailures(fixture);
  await AdapterCertification.assertFingerprint(fixture);
  await AdapterCertification.assertAmbiguity(fixture);
}
