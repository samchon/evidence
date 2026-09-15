import { EvidenceAdapterCertification } from "../../internal/certification/EvidenceAdapterCertification";
import { EvidenceAdapterCertificationFixtures } from "../../internal/certification/EvidenceAdapterCertificationFixtures";

/**
 * Certifies exact adapter inventories, ownership, hosts, withdrawals, and
 * source ranges.
 *
 * The independently declared fixture surface prevents an adapter from passing
 * by publishing only a convenient subset of its parsed declarations.
 *
 * 1. Analyze every shared adapter fixture.
 * 2. Compare units, addresses, attached hosts, and withdrawn hierarchy with
 *    fixture expectations.
 * 3. Verify Unicode annotation ranges retain the expected source coordinates.
 */
export async function test_adapter_certification_inventories(): Promise<void> {
  for (const certification of EvidenceAdapterCertificationFixtures.all()) {
    const inventory = await EvidenceAdapterCertification.analyze(certification);
    EvidenceAdapterCertification.assertInventory(certification, inventory);
  }
}
