import { EvidAdapterCertification } from "../../internal/certification/EvidAdapterCertification";
import { EvidAdapterCertificationFixtures } from "../../internal/certification/EvidAdapterCertificationFixtures";

/** Certifies Dart inventory, graph, failure, fingerprint, and ambiguity behavior.
 *
 * The Dart fixture supplies an independent public surface for the shared certification helpers.
 *
 * 1. Locate the Dart certification fixture.
 * 2. Validate its analyzed inventory against the fixture.
 * 3. Run its graph, failure, fingerprint, and ambiguity certifications.
 */
export async function test_dart_certification(): Promise<void> {
  const fixture = EvidAdapterCertificationFixtures.all().find(
    (item) => item.type === "dart",
  );
  if (fixture === undefined)
    throw new Error("Dart certification fixture is missing.");

  EvidAdapterCertification.assertInventory(
    fixture,
    await EvidAdapterCertification.analyze(fixture),
  );
  await EvidAdapterCertification.assertGraph(fixture);
  await EvidAdapterCertification.assertFailures(fixture);
  await EvidAdapterCertification.assertFingerprint(fixture);
  await EvidAdapterCertification.assertAmbiguity(fixture);
}
