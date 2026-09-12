import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Requires exact units, ownership, addresses, hosts, withdrawals, and Unicode ranges. */
export async function test_adapter_certification_inventories(): Promise<void> {
  for (const certification of AdapterCertificationFixtures.all()) {
    const inventory = await AdapterCertification.analyze(certification);
    AdapterCertification.assertInventory(certification, inventory);
  }
}
