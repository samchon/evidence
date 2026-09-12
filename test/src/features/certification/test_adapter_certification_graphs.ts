import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";

/** Requires passing and missing-evidence graphs for every common programming kind. */
export async function test_adapter_certification_graphs(): Promise<void> {
  for (const certification of AdapterCertificationFixtures.all())
    await AdapterCertification.assertGraph(certification);
}
