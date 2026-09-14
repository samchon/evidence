import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Certifies Kotlin inventory, graph, failure, fingerprint, and ambiguity behavior.
 *
 * The Kotlin fixture is an independent expected surface for shared certification.
 *
 * 1. Analyze its inventory. 2. Validate fixture equality. 3. Run graph, failure, fingerprint, and ambiguity checks.
 */
export async function test_kotlin_certification(): Promise<void> {
  const fixture = AdapterCertificationFixtures.all().find(
    (item) => item.type === "kotlin",
  );
  if (fixture === undefined)
    throw new Error("Kotlin certification fixture is missing.");

  AdapterCertification.assertInventory(
    fixture,
    await AdapterCertification.analyze(fixture),
  );
  await AdapterCertification.assertGraph(fixture);
  await AdapterCertification.assertFailures(fixture);
  await AdapterCertification.assertFingerprint(fixture);
  await AdapterCertification.assertAmbiguity(fixture);
}
