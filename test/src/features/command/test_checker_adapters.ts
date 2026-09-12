import { TestValidator } from "@nestia/e2e";
import assert from "node:assert/strict";

import { EvidenceLanguageRegistry } from "../../../../packages/evidence/src/EvidenceLanguageRegistry";
import { EvidenceAdapterFactory } from "../../../../packages/evidence/src/internal/EvidenceAdapterFactory";
import type { EvidenceArtifactType } from "../../../../packages/evidence/src/typings/EvidenceArtifactType";

/** Keeps checker dispatch aligned with every certified artifact adapter. */
export function test_checker_adapters(): void {
  // Every advertised programming language reaches an adapter of the same type.
  for (const language of EvidenceLanguageRegistry.list())
    if (language.adapter !== undefined)
      TestValidator.equals(
        `checker adapter: ${language.type}`,
        EvidenceAdapterFactory.create(language.type).type,
        language.type,
      );

  // Non-programming adapters share the same dispatch boundary.
  const artifactTypes: EvidenceArtifactType[] = [
    "markdown",
    "prisma",
    "swagger",
  ];
  for (const type of artifactTypes)
    TestValidator.equals(
      `checker adapter: ${type}`,
      EvidenceAdapterFactory.create(type).type,
      type,
    );

  // Declared future database types cannot enter a check before certification.
  assert.throws(() => EvidenceAdapterFactory.create("sql"));
}
