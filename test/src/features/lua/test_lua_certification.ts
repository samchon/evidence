import { EvidAdapterCertification } from "../../internal/certification/EvidAdapterCertification";
import { EvidLuaCertificationFixture } from "../../internal/certification/EvidLuaCertificationFixture";

/** Certifies Lua ownership, failures, graph coverage, ambiguity, and fingerprints.
 *
 * The Lua fixture supplies independently declared assertions for the adapter's supported module surface.
 *
 * 1. Validate fixture inventory. 2. Run graph and failure checks. 3. Verify ambiguity and fingerprint behavior.
 */
export async function test_lua_certification(): Promise<void> {
  const fixture = EvidLuaCertificationFixture.create();

  EvidAdapterCertification.assertInventory(
    fixture,
    await EvidAdapterCertification.analyze(fixture),
  );
  await EvidAdapterCertification.assertGraph(fixture);
  await EvidAdapterCertification.assertFailures(fixture);
  await EvidAdapterCertification.assertFingerprint(fixture);
  await EvidAdapterCertification.assertAmbiguity(fixture);
}
