import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Certifies mutation-sensitive fingerprints and ambiguous target handling.
 *
 * Adapters must change a unit fingerprint for implementation content and must not resolve an injected collision to an arbitrary declaration.
 *
 * 1. Run mutation certification for each shared adapter fixture.
 * 2. Change the fixture's declared implementation content and require its fingerprint to move.
 * 3. Inject a competing target and require the resolver to report ambiguity.
 */
export async function test_adapter_certification_mutations(): Promise<void> {
  for (const certification of AdapterCertificationFixtures.all()) {
    await AdapterCertification.assertFingerprint(certification);
    await AdapterCertification.assertAmbiguity(certification);
  }
}
