import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Certifies exact adapter inventories, ownership, hosts, withdrawals, and source ranges.
 *
 * The independently declared fixture surface prevents an adapter from passing by publishing only a convenient subset of its parsed declarations.
 *
 * 1. Analyze every shared adapter fixture.
 * 2. Compare units, addresses, attached hosts, and withdrawn hierarchy with fixture expectations.
 * 3. Verify Unicode annotation ranges retain the expected source coordinates.
 */
export async function test_adapter_certification_inventories(): Promise<void> {
  for (const certification of AdapterCertificationFixtures.all()) {
    const inventory = await AdapterCertification.analyze(certification);
    AdapterCertification.assertInventory(certification, inventory);
  }
}
