import { DbmlCertificationFixture } from "../../internal/DbmlCertificationFixture";
import { DatabaseAdapterCertification } from "../../internal/certification/DatabaseAdapterCertification";

/** Certifies DBML exact inventories, all selector claim graphs, failures, review fingerprints and ambiguity. */
export async function test_dbml_certification(): Promise<void> {
  const fixture = DbmlCertificationFixture.create();
  DatabaseAdapterCertification.assertInventory(fixture, await DatabaseAdapterCertification.analyze(fixture));
  await DatabaseAdapterCertification.assertGraph(fixture);
  await DatabaseAdapterCertification.assertFailures(fixture);
  await DatabaseAdapterCertification.assertFingerprint(fixture);
  await DatabaseAdapterCertification.assertAmbiguity(fixture);
}
