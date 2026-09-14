import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Certifies Dart inventory, graph, failure, fingerprint, and ambiguity behavior.
 *
 * The Dart fixture supplies an independent public surface for the shared certification helpers.
 *
 * 1. Locate the Dart certification fixture.
 * 2. Validate its analyzed inventory against the fixture.
 * 3. Run its graph, failure, fingerprint, and ambiguity certifications.
 */
export async function test_dart_certification(): Promise<void> {
  const fixture = AdapterCertificationFixtures.all().find(
    (item) => item.type === "dart",
  );
  if (fixture === undefined)
    throw new Error("Dart certification fixture is missing.");

  AdapterCertification.assertInventory(
    fixture,
    await AdapterCertification.analyze(fixture),
  );
  await AdapterCertification.assertGraph(fixture);
  await AdapterCertification.assertFailures(fixture);
  await AdapterCertification.assertFingerprint(fixture);
  await AdapterCertification.assertAmbiguity(fixture);
}
