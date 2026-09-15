import { EvidAdapterCertification } from "../../internal/certification/EvidAdapterCertification";
import { EvidAdapterCertificationFixtures } from "../../internal/certification/EvidAdapterCertificationFixtures";

/**
 * Certifies Kotlin inventory, graph, failure, fingerprint, and ambiguity
 * behavior.
 *
 * The Kotlin fixture is an independent expected surface for shared
 * certification.
 *
 * 1. Analyze its inventory. 2. Validate fixture equality. 3. Run graph, failure,
 *    fingerprint, and ambiguity checks.
 */
export async function test_kotlin_certification(): Promise<void> {
  const fixture = EvidAdapterCertificationFixtures.all().find(
    (item) => item.type === "kotlin",
  );
  if (fixture === undefined)
    throw new Error("Kotlin certification fixture is missing.");

  EvidAdapterCertification.assertInventory(
    fixture,
    await EvidAdapterCertification.analyze(fixture),
  );
  await EvidAdapterCertification.assertGraph(fixture);
  await EvidAdapterCertification.assertFailures(fixture);
  await EvidAdapterCertification.assertFingerprint(fixture);
  await EvidAdapterCertification.assertAmbiguity(fixture);
}
