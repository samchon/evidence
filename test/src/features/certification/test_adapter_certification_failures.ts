import { EvidAdapterCertification } from "../../internal/certification/EvidAdapterCertification";
import { EvidAdapterCertificationFixtures } from "../../internal/certification/EvidAdapterCertificationFixtures";

/**
 * Certifies that common adapters fail safely on incomplete or misleading
 * source.
 *
 * Certification fixtures exercise adapter boundaries where a partial inventory
 * could otherwise make graph coverage look successful.
 *
 * 1. Run failure certification for every shared adapter fixture.
 * 2. Require unsupported and malformed source to produce incomplete inventories.
 * 3. Require literal false-positive annotations to remain rejected rather than
 *    becoming evidence.
 */
export async function test_adapter_certification_failures(): Promise<void> {
  for (const certification of EvidAdapterCertificationFixtures.all())
    await EvidAdapterCertification.assertFailures(certification);
}
