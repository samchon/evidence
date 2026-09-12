import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Requires content fingerprints to move and injected target collisions to stay ambiguous. */
export async function test_adapter_certification_mutations(): Promise<void> {
  for (const certification of AdapterCertificationFixtures.all()) {
    await AdapterCertification.assertFingerprint(certification);
    await AdapterCertification.assertAmbiguity(certification);
  }
}
