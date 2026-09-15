import { EvidAdapterCertification } from "../../internal/certification/EvidAdapterCertification";
import { EvidAdapterCertificationFixtures } from "../../internal/certification/EvidAdapterCertificationFixtures";

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
  const fixture = EvidAdapterCertificationFixtures.all().find(
    (item) => item.type === "scala",
  );
  if (fixture === undefined)
    throw new Error("Scala certification fixture is missing.");

  EvidAdapterCertification.assertInventory(
    fixture,
    await EvidAdapterCertification.analyze(fixture),
  );
  await EvidAdapterCertification.assertGraph(fixture);
  await EvidAdapterCertification.assertFailures(fixture);
  await EvidAdapterCertification.assertFingerprint(fixture);
  await EvidAdapterCertification.assertAmbiguity(fixture);
}
