import { EvidAdapterCertification } from "../../internal/certification/EvidAdapterCertification";
import { EvidAdapterCertificationFixtures } from "../../internal/certification/EvidAdapterCertificationFixtures";

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
  for (const certification of EvidAdapterCertificationFixtures.all()) {
    const inventory = await EvidAdapterCertification.analyze(certification);
    EvidAdapterCertification.assertInventory(certification, inventory);
  }
}
