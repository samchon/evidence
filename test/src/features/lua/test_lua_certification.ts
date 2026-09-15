import { EvidenceAdapterCertification } from "../../internal/certification/EvidenceAdapterCertification";
import { EvidenceLuaCertificationFixture } from "../../internal/certification/EvidenceLuaCertificationFixture";

/**
 * Certifies Lua ownership, failures, graph coverage, ambiguity, and
 * fingerprints.
 *
 * The Lua fixture supplies independently declared assertions for the adapter's
 * supported module surface.
 *
 * 1. Validate fixture inventory. 2. Run graph and failure checks. 3. Verify
 *    ambiguity and fingerprint behavior.
 */
export async function test_lua_certification(): Promise<void> {
  const fixture = EvidenceLuaCertificationFixture.create();

  EvidenceAdapterCertification.assertInventory(
    fixture,
    await EvidenceAdapterCertification.analyze(fixture),
  );
  await EvidenceAdapterCertification.assertGraph(fixture);
  await EvidenceAdapterCertification.assertFailures(fixture);
  await EvidenceAdapterCertification.assertFingerprint(fixture);
  await EvidenceAdapterCertification.assertAmbiguity(fixture);
}
