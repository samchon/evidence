import { EvidenceParserError } from "./EvidenceParserError";
import type { IEvidenceLanguage } from "./structures/IEvidenceLanguage";
import type { IEvidenceLanguageGrammar } from "./structures/IEvidenceLanguageGrammar";
import type { EvidenceProgrammingType } from "./typings/EvidenceProgrammingType";

/** Selects packaged syntax from the configured type and exact logical file name. */
export namespace EvidenceLanguageRegistry {
  /** Returns independent metadata; grammar availability does not imply an Evidence adapter. */
  export function list(): IEvidenceLanguage[] {
    return structuredClone(LANGUAGES);
  }

  /** Rejects unimplemented grammars and mismatched files without guessing another language. */
  export function select(
    type: EvidenceProgrammingType,
    file: string,
  ): IEvidenceLanguageGrammar {
    const language = LANGUAGES.find((entry) => entry.type === type);
    if (language === undefined)
      throw new EvidenceParserError(
        "unsupported-language",
        file,
        `No packaged grammar for ${type}. Add its grammar and Evidence adapter before selecting it.`,
      );
    const basename = file.replaceAll("\\", "/").split("/").pop() ?? "";
    const grammar = language.grammars.find(
      (entry) =>
        entry.filenames.includes(basename) ||
        entry.extensions.some((extension) => basename.endsWith(extension)),
    );
    if (grammar === undefined)
      throw new EvidenceParserError(
        "unsupported-extension",
        file,
        `The selected file is not a recognized ${language.name} source. Correct its population type or file selection.`,
      );
    return structuredClone(grammar);
  }

  const LANGUAGES: IEvidenceLanguage[] = [
    {
      type: "typescript",
      name: "TypeScript",
      grammars: [
        {
          id: "typescript",
          extensions: [".ts", ".cts", ".mts"],
          filenames: [],
        },
        { id: "tsx", extensions: [".tsx"], filenames: [] },
      ],
      adapter: {
        entry: "EvidenceTypeScriptAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Static TypeScript module exports and declaration files within the selected snapshot.",
        comments: ["JSDoc"],
        unsupported: [
          "package exports",
          "path aliases",
          "ambient modules",
          "global augmentations",
          "CommonJS export assignment",
        ],
      },
    },
    {
      type: "javascript",
      name: "JavaScript",
      grammars: [
        {
          id: "javascript",
          extensions: [".js", ".jsx", ".cjs", ".mjs"],
          filenames: [],
        },
      ],
      adapter: {
        entry: "EvidenceJavaScriptAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Static ESM exports and bounded CommonJS initialization.",
        comments: ["JSDoc"],
        unsupported: [
          "dynamic CommonJS exports",
          "computed CommonJS keys",
          "unsafe CommonJS aliases",
        ],
      },
    },
    {
      type: "python",
      name: "Python",
      grammars: [{ id: "python", extensions: [".py", ".pyi"], filenames: [] }],
      adapter: {
        entry: "EvidencePythonAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Statically declared Python module exports with bounded local import and __all__ resolution.",
        comments: ["docstring", "adjacent # comment"],
        unsupported: [
          "executed module discovery",
          "dynamic __all__ mutation",
          "decorator-generated members",
          "metaclass-generated members",
        ],
      },
    },
    {
      type: "go",
      name: "Go",
      grammars: [{ id: "go", extensions: [".go"], filenames: [] }],
    },
    {
      type: "rust",
      name: "Rust",
      grammars: [{ id: "rust", extensions: [".rs"], filenames: [] }],
    },
    {
      type: "java",
      name: "Java",
      grammars: [{ id: "java", extensions: [".java"], filenames: [] }],
    },
    {
      type: "csharp",
      name: "C#",
      grammars: [{ id: "c-sharp", extensions: [".cs"], filenames: [] }],
    },
    {
      type: "c",
      name: "C",
      grammars: [{ id: "c", extensions: [".c", ".h"], filenames: [] }],
    },
    {
      type: "cpp",
      name: "C++",
      grammars: [
        {
          id: "cpp",
          extensions: [
            ".cpp",
            ".cc",
            ".cxx",
            ".c++",
            ".C",
            ".h",
            ".hpp",
            ".hh",
            ".hxx",
            ".h++",
            ".H",
            ".ipp",
            ".tpp",
            ".ixx",
            ".cppm",
            ".ccm",
            ".cxxm",
            ".c++m",
          ],
          filenames: [],
        },
      ],
    },
    {
      type: "ruby",
      name: "Ruby",
      grammars: [
        {
          id: "ruby",
          extensions: [".rb", ".rake", ".gemspec"],
          filenames: ["Gemfile", "Rakefile"],
        },
      ],
    },
  ];
}
