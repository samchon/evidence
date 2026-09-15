import { EvidAdapterCertification } from "../../internal/certification/EvidAdapterCertification";
import { EvidAdapterCertificationFixtures } from "../../internal/certification/EvidAdapterCertificationFixtures";

/** Certifies passing and missing-evidence graphs for every common adapter fixture.
 *
 * The shared contract checks both graph success and exact missing populations for the type, function, and property categories each adapter supports.
 *
 * 1. Load each programming-language certification fixture.
 * 2. Evaluate its passing graph and its deliberately uncovered graph.
 * 3. Require the uncovered graph to identify the expected missing units.
 */
export async function test_adapter_certification_graphs(): Promise<void> {
  for (const certification of EvidAdapterCertificationFixtures.all())
    await EvidAdapterCertification.assertGraph(certification);
}
