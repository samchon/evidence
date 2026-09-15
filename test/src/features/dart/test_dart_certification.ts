import { EvidenceAdapterCertification } from "../../internal/certification/EvidenceAdapterCertification";
import { EvidenceAdapterCertificationFixtures } from "../../internal/certification/EvidenceAdapterCertificationFixtures";

/**
 * Certifies Dart inventory, graph, failure, fingerprint, and ambiguity
 * behavior.
 *
 * The Dart fixture supplies an independent public surface for the shared
 * certification helpers.
 *
 * 1. Locate the Dart certification fixture.
 * 2. Validate its analyzed inventory against the fixture.
 * 3. Run its graph, failure, fingerprint, and ambiguity certifications.
 */
export async function test_dart_certification(): Promise<void> {
  const fixture = EvidenceAdapterCertificationFixtures.all().find(
    (item) => item.type === "dart",
  );
  if (fixture === undefined)
    throw new Error("Dart certification fixture is missing.");

  EvidenceAdapterCertification.assertInventory(
    fixture,
    await EvidenceAdapterCertification.analyze(fixture),
  );
  await EvidenceAdapterCertification.assertGraph(fixture);
  await EvidenceAdapterCertification.assertFailures(fixture);
  await EvidenceAdapterCertification.assertFingerprint(fixture);
  await EvidenceAdapterCertification.assertAmbiguity(fixture);
}
