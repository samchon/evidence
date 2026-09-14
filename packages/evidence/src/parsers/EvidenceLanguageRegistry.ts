import type { EvidenceDatabaseType } from "../typings/EvidenceDatabaseType";
import type { IEvidenceDatabaseLanguage } from "../structures/IEvidenceDatabaseLanguage";
import { EvidenceParserError } from "./EvidenceParserError";
import type { IEvidenceLanguage } from "../structures/IEvidenceLanguage";
import type { IEvidenceLanguageCandidate } from "../structures/IEvidenceLanguageCandidate";
import type { IEvidenceLanguageGrammar } from "../structures/IEvidenceLanguageGrammar";
import type { EvidenceProgrammingType } from "../typings/EvidenceProgrammingType";

/** Selects pinned syntax from the configured type and exact logical file name. */
export namespace EvidenceLanguageRegistry {
  /** Returns independent metadata; grammar availability does not imply an Evidence adapter. */
  export function list(): IEvidenceLanguage[] {
    return structuredClone(LANGUAGES);
  }

  /** Returns independently certified database grammar metadata. */
  export function databases(): IEvidenceDatabaseLanguage[] {
    return structuredClone(DATABASES);
  }

  /** Returns researched candidates without advertising them as supported languages. */
  export function candidates(): IEvidenceLanguageCandidate[] {
    return structuredClone(CANDIDATES);
  }

  /** Rejects unimplemented grammars and mismatched files without guessing another language. */
  export function select(
    type: EvidenceProgrammingType | EvidenceDatabaseType,
    file: string,
  ): IEvidenceLanguageGrammar {
    const language = [...LANGUAGES, ...DATABASES].find(
      (entry) => entry.type === type,
    );
    if (language === undefined)
      throw new EvidenceParserError(
        "unsupported-language",
        file,
        `No registered grammar for ${type}. Add its grammar and Evidence adapter before selecting it.`,
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

  const DATABASES: IEvidenceDatabaseLanguage[] = [
    {
      type: "sqlite",
      name: "SQLite",
      grammars: [
        { id: "sqlite", extensions: [".sql", ".sqlite"], filenames: [] },
      ],
      adapter: {
        entry: "EvidenceSqliteAdapter",
        symbols: ["model", "column", "relation"],
        publicSurface:
          "Explicit SQLite CREATE TABLE declarations, columns, and foreign keys across selected schema files.",
        addressing:
          "File-qualified decoded source names with literal schema and table segments; case-insensitive schema identities are independent of files.",
        comments: ["adjacent leading SQLite line and block comments"],
        unsupported: [
          "runtime database inspection",
          "schema mutations",
          "virtual tables",
          "CREATE TABLE AS",
          "ATTACH and PRAGMA execution",
          "views and triggers",
        ],
      },
    },
    {
      type: "postgresql",
      name: "PostgreSQL",
      grammars: [{ id: "sql", extensions: [".sql"], filenames: [] }],
      adapter: {
        entry: "EvidencePostgresqlAdapter",
        symbols: ["model", "column", "relation"],
        publicSurface:
          "Explicit schema-qualified PostgreSQL table declarations, columns, foreign keys, and additive ALTER declarations within the selected snapshot.",
        addressing:
          "File-qualified schema and table segments; unquoted ASCII names fold to lowercase and quoted names remain literal.",
        comments: ["adjacent SQL comments", "COMMENT ON TABLE or COLUMN"],
        unsupported: [
          "search_path evaluation",
          "conditional DDL",
          "inheritance and partitioning",
          "LIKE, OF, and AS-derived schemas",
          "destructive ALTER",
          "executed migrations",
        ],
      },
    },
    {
      type: "mysql",
      name: "MySQL",
      grammars: [{ id: "mysql", extensions: [".sql"], filenames: [] }],
      adapter: {
        entry: "EvidenceMysqlAdapter",
        symbols: ["model", "column", "relation"],
        publicSurface:
          "Explicit MySQL CREATE TABLE source declarations with column and table foreign-key ownership.",
        addressing:
          "File-qualified, source-case database and table segments; endpoint-derived foreign-key segments.",
        comments: ["adjacent SQL comments", "table and column COMMENT strings"],
        unsupported: [
          "schema migrations",
          "dynamic SQL",
          "stored routines",
          "session modes",
          "generated columns",
          "views",
          "temporary tables",
          "named CONSTRAINT foreign keys",
        ],
      },
    },
    {
      type: "sql",
      name: "Portable SQL",
      grammars: [{ id: "sql", extensions: [".sql"], filenames: [] }],
      adapter: {
        entry: "EvidenceSqlAdapter",
        symbols: ["model", "column", "relation"],
        publicSurface:
          "Explicit CREATE TABLE declarations in the documented portable DDL subset.",
        addressing:
          "Qualified table and column accessors; foreign keys use a literal endpoint-derived member segment.",
        comments: ["adjacent -- or block documentation"],
        unsupported: [
          "schema mutations",
          "query-derived tables",
          "dialect extensions",
          "runtime database discovery",
        ],
      },
    },
  ];

  const LANGUAGES: IEvidenceLanguage[] = [
    {
      type: "objc",
      name: "Objective-C",
      grammars: [{ id: "objc", extensions: [".m", ".h"], filenames: [] }],
      adapter: {
        entry: "EvidenceObjcAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Explicit interfaces, protocols, named categories, public ivars, properties and external C functions in the selected Objective-C snapshot.",
        addressing:
          "File-qualified nominal owners; protocols and categories use quoted names, and method selectors retain their + or - prefix and all colons.",
        comments: ["attached Doxygen"],
        unsupported: [
          "Objective-C++",
          "conditional compilation",
          "macro expansion",
          "include traversal",
          "external C data and aggregate types",
          "compatibility aliases",
          "inherited and synthesized declarations",
        ],
      },
    },
    {
      type: "dart",
      name: "Dart",
      grammars: [{ id: "dart", extensions: [".dart"], filenames: [] }],
      adapter: {
        entry: "EvidenceDartAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Explicit public Dart declarations across selected defining libraries, reciprocal parts, and static relative exports.",
        addressing:
          "File-qualified library names and lexical members, with part and show/hide export aliases sharing semantic identity.",
        comments: ["attached /// or /** */ Dart documentation"],
        unsupported: [
          "package and SDK export URIs",
          "conditional exports",
          "augmentation",
          "inherited or generated members absent from selected source",
        ],
      },
    },
    {
      type: "php",
      name: "PHP",
      grammars: [{ id: "php", extensions: [".php"], filenames: [] }],
      adapter: {
        entry: "EvidencePhpAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Explicit namespace declarations and public members in tagged PHP source recognized by tree-sitter-php v0.24.2.",
        addressing:
          "File-qualified namespace and owner segments; properties retain their leading dollar sign; constants and methods do not.",
        comments: ["attached PHPDoc"],
        unsupported: [
          "tagless PHP-only input",
          "trait composition",
          "conditional declarations",
          "runtime includes and autoload discovery",
          "dynamic declaration generation",
          "inherited and generated members",
        ],
      },
    },
    {
      type: "scala",
      name: "Scala",
      grammars: [{ id: "scala", extensions: [".scala"], filenames: [] }],
      adapter: {
        entry: "EvidenceScalaAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Explicit unrestricted Scala 2/3 declarations recognized by tree-sitter-scala v0.26.2 within the selected source snapshot.",
        addressing:
          "File-qualified package and lexical owner paths; singleton objects and package objects have explicit quoted owner segments.",
        comments: ["attached Scaladoc"],
        unsupported: [
          "anonymous givens",
          "wildcard and unresolved exports",
          "inherited and synthesized members",
          "macro expansion",
          "derives and uses clauses",
          "extractor binding patterns",
        ],
      },
    },
    {
      type: "matlab",
      name: "MATLAB",
      grammars: [{ id: "matlab", extensions: [".m"], filenames: [] }],
      adapter: {
        entry: "EvidenceMatlabAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Explicit textual MATLAB classdef and primary function declarations with class-folder ownership.",
        addressing:
          "File-qualified package and class segments; accessors merge with declared properties and external methods with class ownership.",
        comments: ["attached percent-line help comments"],
        unsupported: [
          "runtime path mutation",
          "dynamic properties",
          "legacy classes",
          "inherited or generated declarations",
          "Octave extensions",
          "binary and live scripts",
        ],
      },
    },
    {
      type: "swift",
      name: "Swift",
      grammars: [{ id: "swift", extensions: [".swift"], filenames: [] }],
      adapter: {
        entry: "EvidenceSwiftAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Explicit public/open declarations in one selected Swift module, including local nominal extensions and protocol requirements.",
        addressing:
          "File-qualified lexical owners; overloads group by base name and static members add a static segment.",
        comments: ["attached DocC /// and /** */"],
        unsupported: [
          "external extension ownership",
          "constrained extensions",
          "macro and custom attribute expansion",
          "conditional compilation",
          "compiler-generated and inherited members",
        ],
      },
    },
    {
      type: "kotlin",
      name: "Kotlin",
      grammars: [{ id: "kotlin", extensions: [".kt"], filenames: [] }],
      adapter: {
        entry: "EvidenceKotlinAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Explicit public Kotlin source declarations recognized by tree-sitter-kotlin v1.1.0 within the selected snapshot.",
        addressing:
          "File-qualified lexical owners, explicit companions, and receiver-qualified extension segments.",
        comments: ["attached KDoc"],
        unsupported: [
          "scripts",
          "multiplatform expect/actual",
          "delegated members",
          "implicit override visibility",
          "generic and unresolved extension receivers",
          "compiler-generated and inherited members",
        ],
      },
    },
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
        addressing:
          "File-qualified export accessors; instance members include prototype while static members do not.",
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
        addressing:
          "File-qualified export accessors; instance members include prototype while static members do not.",
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
        addressing:
          "File-qualified module accessors; instance members include prototype while class members do not.",
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
      adapter: {
        entry: "EvidenceGoAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Selected exported Go package declarations with package-wide receiver ownership.",
        addressing:
          "File-qualified package declarations with receiver and interface members under their owner type.",
        comments: ["adjacent // or block documentation comment"],
        unsupported: [
          "GOOS and GOARCH evaluation",
          "promoted members",
          "dependency-derived members",
          "generated declarations absent from selected source",
        ],
      },
    },
    {
      type: "rust",
      name: "Rust",
      grammars: [{ id: "rust", extensions: [".rs"], filenames: [] }],
      adapter: {
        entry: "EvidenceRustAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Selected Rust crate modules, public reexports, and local nominal impl members.",
        addressing:
          "File-qualified public paths; trait implementations add an explicit quoted impl segment.",
        comments: ["outer or inner documentation", "static doc attribute"],
        unsupported: [
          "Cargo feature evaluation",
          "macro expansion",
          "custom module paths",
          "external type ownership",
          "generated declarations absent from selected source",
        ],
      },
    },
    {
      type: "java",
      name: "Java",
      grammars: [{ id: "java", extensions: [".java"], filenames: [] }],
      adapter: {
        entry: "EvidenceJavaAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Java source-public declarations recognized by tree-sitter-java v0.23.5, independent of JPMS exports.",
        addressing:
          "File-qualified top-level and nested type accessors with methods grouped by owner and name.",
        comments: ["attached Javadoc"],
        unsupported: [
          "JPMS package export enforcement",
          "annotation processor execution",
          "compiler-generated record and enum methods",
          "inherited members",
          "generated declarations absent from selected source",
        ],
      },
    },
    {
      type: "csharp",
      name: "C#",
      grammars: [{ id: "c-sharp", extensions: [".cs"], filenames: [] }],
      adapter: {
        entry: "EvidenceCSharpAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "C# source-public declarations recognized by tree-sitter-c-sharp v0.23.5 within one configured source snapshot.",
        addressing:
          "File-qualified namespace and owner accessors with quoted segments for generic arity, indexers, and operators.",
        comments: ["attached /// or /** */ XML documentation"],
        unsupported: [
          "conditional-compilation evaluation",
          "explicit interface implementation units",
          "source-generator execution",
          "compiler-generated record members",
          "inherited members",
        ],
      },
    },
    {
      type: "c",
      name: "C",
      grammars: [{ id: "c", extensions: [".c", ".h"], filenames: [] }],
      adapter: {
        entry: "EvidenceCAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Explicit external declarations, tags, typedefs, aggregate fields, and enumerators recognized by tree-sitter-c v0.24.2 within each selected physical file.",
        addressing:
          "File-qualified declarations with exact quoted tag names and unambiguous typedef or source-name aliases.",
        comments: ["attached Doxygen"],
        unsupported: [
          "preprocessor branch evaluation",
          "macro expansion",
          "include traversal",
          "linker export policy",
          "generated declarations absent from selected source",
        ],
      },
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
      adapter: {
        entry: "EvidenceCppAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Explicit namespaces, public types and members, external declarations, templates, and bounded aliases recognized by tree-sitter-cpp v0.23.4 across the selected snapshot.",
        addressing:
          "File-qualified namespace and owner accessors with quoted segments for template arity and operators.",
        comments: ["attached Doxygen"],
        unsupported: [
          "preprocessor branch evaluation",
          "macro expansion",
          "include traversal",
          "template specialization and instantiation",
          "inheritance and friend lookup",
          "modules and linker visibility",
        ],
      },
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
      adapter: {
        entry: "EvidenceRubyAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Explicit classes and modules, public instance and singleton methods, constants, literal attributes, bounded aliases, and reopenings recognized by tree-sitter-ruby v0.23.1 across the selected snapshot.",
        addressing:
          "File-qualified constant paths; instance members use their owner directly and singleton members add self.",
        comments: ["adjacent Ruby line or embedded RDoc comments"],
        unsupported: [
          "runtime load order",
          "dynamic method and constant generation",
          "mixin and refinement expansion",
          "eval-created declarations",
          "inherited members",
        ],
      },
    },
  ];

  const CANDIDATES: IEvidenceLanguageCandidate[] = [
    {
      id: "lua",
      name: "Lua",
      kind: "programming-language",
      dialects: ["Lua source"],
      grammarRepository:
        "https://github.com/tree-sitter-grammars/tree-sitter-lua",
      grammarLicense: "MIT",
      wasm: "release-asset",
      wasmNotes: "The v0.5.0 release publishes tree-sitter-lua.wasm.",
      languageReference: "https://www.lua.org/manual/5.4/manual.html#3.2",
      visibility:
        "lexical local declarations are explicit, but modules and public exports are conventions over globals and returned tables",
      declarations:
        "local/global functions and variables, table fields, and returned module tables",
      blockers: [
        "the language has no normative module export declaration",
        "table aliases and mutations are dynamic",
        "require paths and loader behavior are environment-defined",
      ],
      next: "Specify a bounded returned-table module convention before deciding whether Lua can claim a complete public inventory.",
    },
    {
      id: "zig",
      name: "Zig",
      kind: "programming-language",
      dialects: ["Zig source"],
      grammarRepository:
        "https://github.com/tree-sitter-grammars/tree-sitter-zig",
      grammarLicense: "MIT",
      wasm: "release-asset",
      wasmNotes: "The v1.1.2 release publishes tree-sitter-zig.wasm.",
      languageReference: "https://ziglang.org/documentation/master/#pub",
      visibility:
        "pub marks declarations available outside their container; unmarked declarations remain container-private",
      declarations:
        "containers, functions, variables, constants, fields, enum values, tests, comptime declarations, and usingnamespace imports",
      blockers: [
        "comptime can generate or select declarations",
        "usingnamespace changes the exported namespace",
        "build options and generic instantiation affect reachable APIs",
      ],
      next: "Certify explicit pub declarations and container ownership while reporting usingnamespace and declaration-producing comptime blocks as incomplete.",
    },
    {
      id: "vue",
      name: "Vue single-file component",
      kind: "embedded-format",
      dialects: ["Vue SFC"],
      grammarRepository:
        "https://github.com/tree-sitter-grammars/tree-sitter-vue",
      grammarLicense: "MIT",
      wasm: "source-build",
      wasmNotes:
        "No upstream release is published; build WASM from a pinned source commit with the Tree-sitter CLI.",
      languageReference: "https://vuejs.org/api/sfc-spec.html",
      visibility:
        "component contracts combine script/module exports, script setup macros, template bindings, styles, and custom blocks",
      declarations:
        "embedded JavaScript/TypeScript regions, component options, defineProps/defineEmits macros, templates, styles, and custom blocks",
      blockers: [
        "embedded regions require offset-preserving extraction",
        "script setup macros need Vue semantics",
        "template and style grammars do not share a programming-symbol model",
      ],
      next: "Implement source-region extraction and mapped host coordinates before delegating script blocks to JavaScript or TypeScript adapters.",
    },
    {
      id: "svelte",
      name: "Svelte component",
      kind: "embedded-format",
      dialects: ["Svelte component"],
      grammarRepository: "https://github.com/sveltejs/tree-sitter-svelte",
      grammarLicense: "MIT",
      wasm: "source-build",
      wasmNotes:
        "No upstream release is published; build WASM from a pinned source commit with the Tree-sitter CLI.",
      languageReference: "https://svelte.dev/docs/svelte/svelte-files",
      visibility:
        "component contracts combine module/instance scripts, exported props or runes, markup, styles, and compiler-generated bindings",
      declarations:
        "embedded JavaScript/TypeScript regions, component props, module exports, markup, styles, and compiler directives",
      blockers: [
        "embedded regions require offset-preserving extraction",
        "Svelte version semantics change component exports",
        "compiler-generated bindings are not explicit syntax declarations",
      ],
      next: "Implement source-region extraction and mapped host coordinates before delegating script blocks to JavaScript or TypeScript adapters.",
    },
  ];
}
