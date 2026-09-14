import { TestValidator } from "@nestia/e2e";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { EvidenceLanguageRegistry } from "../../../../packages/evidence/src/parsers/EvidenceLanguageRegistry";
import type { EvidenceLanguageCandidateId } from "../../../../packages/evidence/src/typings/EvidenceLanguageCandidateId";

/** Keeps researched candidates concrete, separate from support, and synchronized with their matrix. */
export async function test_language_candidate_matrix(): Promise<void> {
  const candidates = EvidenceLanguageRegistry.candidates();
  const supported = new Set<string>(
    EvidenceLanguageRegistry.list().map((language) => language.type),
  );
  const document = await readFile(
    join(__dirname, "../../../../docs/development/language-candidates.md"),
    "utf8",
  );
  const expected: EvidenceLanguageCandidateId[] = [
    "kotlin",
    "swift",
    "php",
    "dart",
    "scala",
    "lua",
    "elixir",
    "erlang",
    "objective-c",
    "zig",
    "vue",
    "svelte",
  ];

  // The candidate catalog is exact, while supported languages remain disjoint.
  TestValidator.equals(
    "researched language candidates",
    candidates.map((candidate) => candidate.id),
    expected,
  );
  TestValidator.predicate(
    "candidates are not advertised as supported",
    candidates.every((candidate) => !supported.has(candidate.id)),
  );
  TestValidator.equals(
    "programming candidate count",
    candidates.filter((candidate) => candidate.kind === "programming-language")
      .length,
    10,
  );
  TestValidator.equals(
    "embedded format candidate count",
    candidates.filter((candidate) => candidate.kind === "embedded-format")
      .length,
    2,
  );

  // Each row retains its primary sources, blockers, and one bounded next task.
  for (const candidate of candidates) {
    const row = candidateSection(document, candidate.id);
    TestValidator.predicate(`${candidate.id} matrix row`, row.length > 0);
    TestValidator.predicate(
      `${candidate.id} matrix kind`,
      row.includes(candidate.kind),
    );
    for (const dialect of candidate.dialects)
      TestValidator.predicate(
        `${candidate.id} dialect: ${dialect}`,
        row.includes(dialect),
      );
    TestValidator.predicate(
      `${candidate.id} grammar source`,
      row.includes(candidate.grammarRepository),
    );
    TestValidator.predicate(
      `${candidate.id} language source`,
      row.includes(candidate.languageReference),
    );
    TestValidator.predicate(
      `${candidate.id} license`,
      row.includes(candidate.grammarLicense),
    );
    TestValidator.predicate(
      `${candidate.id} WASM availability`,
      row.includes(candidate.wasm),
    );
    TestValidator.predicate(
      `${candidate.id} WASM provenance`,
      row.includes(candidate.wasmNotes),
    );
    TestValidator.predicate(
      `${candidate.id} visibility boundary`,
      row.includes(candidate.visibility),
    );
    TestValidator.predicate(
      `${candidate.id} declaration surface`,
      row.includes(candidate.declarations),
    );
    for (const blocker of candidate.blockers)
      TestValidator.predicate(
        `${candidate.id} blocker: ${blocker}`,
        row.includes(blocker),
      );
    TestValidator.predicate(
      `${candidate.id} next task`,
      row.includes(candidate.next),
    );
  }
}

function candidateSection(
  document: string,
  id: EvidenceLanguageCandidateId,
): string {
  const marker = `(\`${id}\`)`;
  const start = document.indexOf(marker);
  if (start === -1) return "";
  const end = document.indexOf("\n### ", start + marker.length);
  return document.slice(start, end === -1 ? document.length : end);
}
