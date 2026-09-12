import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Requires incomplete surfaces, malformed syntax, and literal false positives to fail safely. */
export async function test_adapter_certification_failures(): Promise<void> {
  for (const certification of AdapterCertificationFixtures.all())
    await AdapterCertification.assertFailures(certification);
}
