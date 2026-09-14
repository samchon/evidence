import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/**
 * Certifies the Scala adapter through the shared adapter contract.
 *
 * The registered Scala certification fixture provides inventory, graph, failure, and fingerprint cases that must remain valid without adapter-specific test rewrites.
 *
 * 1. Locate the Scala fixture in the shared certification set.
 * 2. Run inventory and graph certification against its adapter and scenarios.
 * 3. Verify incomplete, fingerprint, and ambiguity expectations through the shared certification helpers.
 */
export async function test_scala_certification(): Promise<void> {
  const fixture = AdapterCertificationFixtures.all().find(
    (item) => item.type === "scala",
  );
  if (fixture === undefined)
    throw new Error("Scala certification fixture is missing.");

  AdapterCertification.assertInventory(
    fixture,
    await AdapterCertification.analyze(fixture),
  );
  await AdapterCertification.assertGraph(fixture);
  await AdapterCertification.assertFailures(fixture);
  await AdapterCertification.assertFingerprint(fixture);
  await AdapterCertification.assertAmbiguity(fixture);
}
