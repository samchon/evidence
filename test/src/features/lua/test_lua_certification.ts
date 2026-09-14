import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { LuaCertificationFixture } from "../../internal/certification/LuaCertificationFixture";

/** Certifies Lua ownership, failures, graph coverage, ambiguity, and fingerprints.
 *
 * The Lua fixture supplies independently declared assertions for the adapter's supported module surface.
 *
 * 1. Validate fixture inventory. 2. Run graph and failure checks. 3. Verify ambiguity and fingerprint behavior.
 */
export async function test_lua_certification(): Promise<void> {
  const fixture = LuaCertificationFixture.create();

  AdapterCertification.assertInventory(
    fixture,
    await AdapterCertification.analyze(fixture),
  );
  await AdapterCertification.assertGraph(fixture);
  await AdapterCertification.assertFailures(fixture);
  await AdapterCertification.assertFingerprint(fixture);
  await AdapterCertification.assertAmbiguity(fixture);
}
