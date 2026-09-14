import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Certifies Objective-C populations, mutation gates, graph failures, and stable reviews. */
export async function test_objc_certification(): Promise<void> {
  const fixture = AdapterCertificationFixtures.all().find(
    (item) => item.type === "objc",
  );
  if (fixture === undefined)
    throw new Error("Missing Objective-C certification fixture.");

  AdapterCertification.assertInventory(
    fixture,
    await AdapterCertification.analyze(fixture),
  );
  await AdapterCertification.assertGraph(fixture);
  await AdapterCertification.assertFailures(fixture);
  await AdapterCertification.assertFingerprint(fixture);
  await AdapterCertification.assertAmbiguity(fixture);
}
