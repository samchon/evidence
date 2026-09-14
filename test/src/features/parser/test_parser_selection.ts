import { EvidenceLanguageRegistry, EvidenceParser } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";

import { TestParserError } from "../../internal/TestParserError";

/**
 * Selects grammar variants from declared language and case-sensitive source spelling.
 *
 * A shared extension does not override the configured language, and inspecting
 * registry metadata must neither mutate later selections nor eagerly initialize
 * grammars. These boundaries keep source-address semantics separate from cache state.
 *
 * 1. Resolve C and C++ headers independently, Windows TSX as the TSX variant,
 *    Ruby's Gemfile as Ruby, and a MATLAB source as MATLAB.
 * 2. Reject a Python request for a TypeScript extension, uppercase .TS, and the
 *    incorrectly cased Ruby named file with unsupported-extension failures.
 * 3. Clear grammar arrays on a returned catalog and require later Python selection
 *    to remain intact, proving inspection results do not expose registry storage.
 * 4. Construct a parser with no loaded languages, parse one Python declaration,
 *    and require Python to be its only completed language load before cleanup.
 */
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

  TestValidator.equals(
    "MATLAB source",
    EvidenceLanguageRegistry.select("matlab", "contract.m").id,
    "matlab",
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
