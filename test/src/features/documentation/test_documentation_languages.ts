import { TestValidator } from "@nestia/e2e";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { EvidenceLanguageRegistry } from "../../../../packages/evidence/src/parsers/EvidenceLanguageRegistry";

/** Keeps the reader-facing programming-language matrix aligned with certified registry entries. */
export async function test_documentation_languages(): Promise<void> {
  const document = await readFile(
    join(__dirname, "../../../../docs/languages.md"),
    "utf8",
  );
  const start = document.indexOf("## Support matrix");
  const end = document.indexOf("## Completeness boundaries");
  if (start === -1 || end === -1 || end <= start)
    throw new Error("The certified language matrix boundaries are missing.");

  // Only the primary support table defines the advertised programming-language count.
  const documented = Array.from(
    document.slice(start, end).matchAll(/^\| `([^`]+)` \|/gmu),
    (match) => match[1],
  );
  const certified = EvidenceLanguageRegistry.list().map(
    (language) => language.type,
  );

  TestValidator.equals("documented certified languages", documented, certified);
  TestValidator.equals(
    "certified programming-language count",
    documented.length,
    10,
  );
  TestValidator.predicate(
    "TSX remains a grammar variant",
    !documented.includes("tsx"),
  );
}
