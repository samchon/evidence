import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Applies the shared adapter certification contract to Zig.
 *
 * The Zig fixture defines expected inventory, graph failure, mutation, and fingerprint behavior.
 *
 * 1. Construct the Zig fixture.
 * 2. Run shared adapter certification.
 * 3. Require every declared gate to pass.
 */
export async function test_zig_certification(): Promise<void> {
  const fixture = AdapterCertificationFixtures.all().find(
    (item) => item.type === "zig",
  );
  if (fixture === undefined)
    throw new Error("Zig certification fixture is missing.");

  AdapterCertification.assertInventory(
    fixture,
    await AdapterCertification.analyze(fixture),
  );
  await AdapterCertification.assertGraph(fixture);
  await AdapterCertification.assertFailures(fixture);
  await AdapterCertification.assertFingerprint(fixture);
  await AdapterCertification.assertAmbiguity(fixture);
}
