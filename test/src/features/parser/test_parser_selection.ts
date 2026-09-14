import { EvidenceLanguageRegistry, EvidenceParser } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TestParserError } from "../../internal/TestParserError";

/** Selects syntax by declared language and exact file spelling while preserving lazy loading. */
export async function test_parser_selection(): Promise<void> {
  // Ambiguous headers follow the configured type; TSX remains a TypeScript variant.
  TestValidator.equals(
    "C header",
    EvidenceLanguageRegistry.select("c", "include/value.h").id,
    "c",
  );
  TestValidator.equals(
    "C++ header",
    EvidenceLanguageRegistry.select("cpp", "include/value.h").id,
    "cpp",
  );
  TestValidator.equals(
    "Windows TSX path",
    EvidenceLanguageRegistry.select("typescript", "C:\\src\\View.tsx").id,
    "tsx",
  );
  TestValidator.equals(
    "Ruby named file",
    EvidenceLanguageRegistry.select("ruby", "Gemfile").id,
    "ruby",
  );

  await TestParserError.expect("unsupported-language", () =>
    EvidenceLanguageRegistry.select("matlab", "contract.m"),
  );
  await TestParserError.expect("unsupported-extension", () =>
    EvidenceLanguageRegistry.select("python", "contract.ts"),
  );
  await TestParserError.expect("unsupported-extension", () =>
    EvidenceLanguageRegistry.select("typescript", "contract.TS"),
  );
  await TestParserError.expect("unsupported-extension", () =>
    EvidenceLanguageRegistry.select("ruby", "gemfile"),
  );

  // Mutating inspection results must not modify later selections or certification metadata.
  const languages = EvidenceLanguageRegistry.list();
  for (const language of languages) language.grammars.splice(0);
  TestValidator.equals(
    "registry is isolated",
    EvidenceLanguageRegistry.select("python", "contract.py").id,
    "python",
  );

  const parser = new EvidenceParser();
  try {
    TestValidator.equals(
      "no eager language initialization",
      parser.state().languages,
      [],
    );

    await parser.parse(
      { type: "python", file: "contract.py", content: "class Contract: pass" },
      (session) => session.root.type,
    );

    TestValidator.equals("Python-only load", parser.state().languages, [
      "python",
    ]);
  } finally {
    await parser.close();
  }
}
