import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Certifies mutation-sensitive fingerprints and ambiguous target handling.
 *
 * Adapters must keep a unit fingerprint stable for annotation prose, change it for implementation content, and never resolve an injected collision to an arbitrary declaration.
 *
 * 1. Run mutation certification for each shared adapter fixture.
 * 2. Change annotation prose and require the fingerprint to remain stable, then change declared implementation content and require it to move.
 * 3. Inject a competing target and require the resolver to report ambiguity.
 */
export async function test_adapter_certification_mutations(): Promise<void> {
  for (const certification of AdapterCertificationFixtures.all()) {
    await AdapterCertification.assertFingerprint(certification);
    await AdapterCertification.assertAmbiguity(certification);
  }
}
