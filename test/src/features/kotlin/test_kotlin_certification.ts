import { EvidenceAdapterCertification } from "../../internal/certification/EvidenceAdapterCertification";
import { EvidenceAdapterCertificationFixtures } from "../../internal/certification/EvidenceAdapterCertificationFixtures";

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
  const fixture = EvidenceAdapterCertificationFixtures.all().find(
    (item) => item.type === "kotlin",
  );
  if (fixture === undefined)
    throw new Error("Kotlin certification fixture is missing.");

  EvidenceAdapterCertification.assertInventory(
    fixture,
    await EvidenceAdapterCertification.analyze(fixture),
  );
  await EvidenceAdapterCertification.assertGraph(fixture);
  await EvidenceAdapterCertification.assertFailures(fixture);
  await EvidenceAdapterCertification.assertFingerprint(fixture);
  await EvidenceAdapterCertification.assertAmbiguity(fixture);
}
