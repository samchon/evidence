import { EvidAdapterCertification } from "../../internal/certification/EvidAdapterCertification";
import { EvidAdapterCertificationFixtures } from "../../internal/certification/EvidAdapterCertificationFixtures";

/** Applies the shared adapter certification contract to PHP.
 *
 * The PHP fixture declares the expected inventory, graph, mutation, and fingerprint behavior.
 *
 * 1. Construct the PHP fixture.
 * 2. Run shared adapter certification.
 * 3. Require every declared gate to pass.
 */
export async function test_php_certification(): Promise<void> {
  const fixture = EvidAdapterCertificationFixtures.all().find(
    (item) => item.type === "php",
  );
  if (fixture === undefined)
    throw new Error("Php certification fixture is missing.");

  EvidAdapterCertification.assertInventory(
    fixture,
    await EvidAdapterCertification.analyze(fixture),
  );
  await EvidAdapterCertification.assertGraph(fixture);
  await EvidAdapterCertification.assertFailures(fixture);
  await EvidAdapterCertification.assertFingerprint(fixture);
  await EvidAdapterCertification.assertAmbiguity(fixture);
}
