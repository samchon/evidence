import { TestValidator } from "@nestia/e2e";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import typia from "typia";

import { TreeSitterAssets } from "../../../../packages/evidence/src/internal/TreeSitterAssets";
import { EvidenceLanguageRegistry } from "../../../../packages/evidence/src/parsers/EvidenceLanguageRegistry";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";
import type { IPackageManifest } from "../../internal/certification/IPackageManifest";

/** Verifies certified adapters have pinned obtainable grammars while distribution excludes the asset directory. */
export async function test_adapter_certification_distribution(): Promise<void> {
  const languages = EvidenceLanguageRegistry.list();
  const certifications = AdapterCertificationFixtures.all();
  const assets = new TreeSitterAssets();
  const grammars = await assets.list();
  const packageDirectory = join(__dirname, "../../../../packages/evidence");
  const manifest = typia.json.assertParse<IPackageManifest>(
    await readFile(join(packageDirectory, "package.json"), "utf8"),
  );

  // Registry support requires one executable certification and adapter declaration.
  TestValidator.equals(
    "certified programming languages",
    languages.map((language) => language.type),
    certifications.map((certification) => certification.type),
  );
  TestValidator.predicate(
    "every registered language has a certified adapter",
    languages.every((language) => language.adapter !== undefined),
  );

  // Every grammar selected by a certified language must be pinned and readable.
  const registeredGrammars = languages.flatMap((language) =>
    language.grammars.map((grammar) => grammar.id),
  );
  TestValidator.equals(
    "certified grammar manifest",
    registeredGrammars,
    grammars.map((grammar) => grammar.id),
  );
  for (const grammar of grammars) {
    const bytes = await assets.bytes(grammar);
    TestValidator.equals(
      `${grammar.id} certified grammar size`,
      bytes.length,
      grammar.wasm.size,
    );
  }

  // Download pins compile into lib; grammar payloads and repository fixtures are absent from distribution.
  TestValidator.equals("published package allowlist", manifest.files, [
    "lib",
    "README.md",
    "LICENSE",
  ]);
}
