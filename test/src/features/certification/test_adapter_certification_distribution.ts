import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import typia from "typia";

import { EvidenceLanguageRegistry } from "../../../../packages/evidence/src/EvidenceLanguageRegistry";
import { TreeSitterAssets } from "../../../../packages/evidence/src/internal/TreeSitterAssets";
import { AdapterCertificationFixtures } from "../../internal/certification/AdapterCertificationFixtures";
import type { IPackageManifest } from "../../internal/certification/IPackageManifest";

/** Verifies every certified adapter has intact grammar bytes included by the package allowlist. */
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
    const license = await readFile(
      join(packageDirectory, "assets", grammar.license.file),
    );
    TestValidator.equals(
      `${grammar.id} certified grammar size`,
      bytes.length,
      grammar.wasm.size,
    );
    TestValidator.equals(
      `${grammar.id} certified license size`,
      license.length,
      grammar.license.size,
    );
    TestValidator.equals(
      `${grammar.id} certified license checksum`,
      createHash("sha256").update(license).digest("hex"),
      grammar.license.sha256,
    );
  }

  // The publish allowlist carries the manifest, every WASM file, and every license.
  for (const pattern of [
    "assets/**/*.wasm",
    "assets/grammars.json",
    "assets/**/LICENSE*",
  ])
    TestValidator.predicate(
      `published package includes ${pattern}`,
      manifest.files.includes(pattern),
    );
}
