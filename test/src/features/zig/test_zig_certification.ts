import { EvidAdapterCertification } from "../../internal/certification/EvidAdapterCertification";
import { EvidAdapterCertificationFixtures } from "../../internal/certification/EvidAdapterCertificationFixtures";

/**
 * Applies the shared adapter certification contract to Zig.
 *
 * The Zig fixture defines expected inventory, graph failure, mutation, and
 * fingerprint behavior.
 *
 * 1. Construct the Zig fixture.
 * 2. Run shared adapter certification.
 * 3. Require every declared gate to pass.
 */
export async function test_zig_certification(): Promise<void> {
  const fixture = EvidAdapterCertificationFixtures.all().find(
    (item) => item.type === "zig",
  );
  if (fixture === undefined)
    throw new Error("Zig certification fixture is missing.");

  EvidAdapterCertification.assertInventory(
    fixture,
    await EvidAdapterCertification.analyze(fixture),
  );
  await EvidAdapterCertification.assertGraph(fixture);
  await EvidAdapterCertification.assertFailures(fixture);
  await EvidAdapterCertification.assertFingerprint(fixture);
  await EvidAdapterCertification.assertAmbiguity(fixture);
}
