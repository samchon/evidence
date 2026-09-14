import { AdapterCertification } from "../../internal/certification/AdapterCertification";
import { luaCertificationFixture } from "../../internal/certification/LuaCertificationFixture";

/** Exercises exact Lua ownership, failures, graph coverage, alias ambiguity, and fingerprint integrity. */
export async function test_lua_certification(): Promise<void> {
  const fixture = luaCertificationFixture();

  AdapterCertification.assertInventory(
    fixture,
    await AdapterCertification.analyze(fixture),
  );
  await AdapterCertification.assertGraph(fixture);
  await AdapterCertification.assertFailures(fixture);
  await AdapterCertification.assertFingerprint(fixture);
  await AdapterCertification.assertAmbiguity(fixture);
}
