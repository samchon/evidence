import { EvidenceParserError } from "./EvidenceParserError";
import type { IEvidenceLanguage } from "./structures/IEvidenceLanguage";
import type { IEvidenceLanguageCandidate } from "./structures/IEvidenceLanguageCandidate";
import type { IEvidenceLanguageGrammar } from "./structures/IEvidenceLanguageGrammar";
import type { EvidenceProgrammingType } from "./typings/EvidenceProgrammingType";

/** Selects packaged syntax from the configured type and exact logical file name. */
export namespace EvidenceLanguageRegistry {
  /** Returns independent metadata; grammar availability does not imply an Evidence adapter. */
  export function list(): IEvidenceLanguage[] {
    return structuredClone(LANGUAGES);
  }

  /** Returns researched candidates without advertising them as supported languages. */
  export function candidates(): IEvidenceLanguageCandidate[] {
    return structuredClone(CANDIDATES);
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
      adapter: {
        entry: "EvidenceGoAdapter",
        symbols: ["type", "function", "property"],
        publicSurface:
          "Selected exported Go package declarations with package-wide receiver ownership.",
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
      id: "kotlin",
      name: "Kotlin",
      kind: "programming-language",
      dialects: ["Kotlin source"],
      grammarRepository:
        "https://github.com/tree-sitter-grammars/tree-sitter-kotlin",
      grammarLicense: "MIT",
      wasm: "release-asset",
      wasmNotes: "The v1.1.0 release publishes tree-sitter-kotlin.wasm.",
      languageReference:
        "https://kotlinlang.org/docs/visibility-modifiers.html",
      visibility:
        "public by default, with internal, protected, and private declarations plus file-private top-level members",
      declarations:
        "packages, classes, interfaces, objects, companions, functions, properties, constructors, type aliases, and extensions",
      blockers: [
        "expect/actual and multiplatform source-set ownership",
        "companion and extension receiver address policy",
        "generated and delegated members",
      ],
      next: "Certify explicit JVM-agnostic source declarations, companion ownership, overload families, and KDoc before resolving multiplatform exports.",
    },
    {
      id: "swift",
      name: "Swift",
      kind: "programming-language",
      dialects: ["Swift source"],
      grammarRepository: "https://github.com/alex-pinkus/tree-sitter-swift",
      grammarLicense: "MIT",
      wasm: "release-asset",
      wasmNotes: "The 0.7.3 release publishes tree-sitter-swift.wasm.",
      languageReference:
        "https://docs.swift.org/swift-book/documentation/the-swift-programming-language/accesscontrol/",
      visibility:
        "internal by default, with open, public, package, fileprivate, and private declarations",
      declarations:
        "modules, nominal types, protocols, extensions, functions, operators, properties, subscripts, and type aliases",
      blockers: [
        "module and package boundaries come from build metadata",
        "extensions merge declarations across files and modules",
        "synthesized protocol and macro members",
      ],
      next: "Define a configured module boundary and certify explicit public/open declarations, extensions, overloads, and DocC comments.",
    },
    {
      id: "php",
      name: "PHP",
      kind: "programming-language",
      dialects: ["PHP with tags", "PHP-only"],
      grammarRepository: "https://github.com/tree-sitter/tree-sitter-php",
      grammarLicense: "MIT",
      wasm: "release-asset",
      wasmNotes:
        "The v0.24.2 release publishes tree-sitter-php.wasm and tree-sitter-php_only.wasm.",
      languageReference:
        "https://www.php.net/manual/en/language.oop5.visibility.php",
      visibility:
        "top-level declarations are namespace-visible; class members use explicit visibility and default to public where PHP permits omission",
      declarations:
        "namespaces, classes, interfaces, traits, enums, functions, methods, properties, constants, and aliases",
      blockers: [
        "PHP and PHP-only grammar dialect selection",
        "Composer/autoload namespace topology",
        "trait composition, conditional declarations, and runtime includes",
      ],
      next: "Certify one namespace-local declared surface for both grammar dialects with trait and conditional boundaries reported as incomplete.",
    },
    {
      id: "dart",
      name: "Dart",
      kind: "programming-language",
      dialects: ["Dart source"],
      grammarRepository: "https://github.com/nielsenko/tree-sitter-dart",
      grammarLicense: "MIT",
      wasm: "source-build",
      wasmNotes:
        "No upstream release asset is published; build WASM from a pinned source commit with the Tree-sitter CLI.",
      languageReference: "https://dart.dev/language/libraries",
      visibility:
        "identifiers beginning with an underscore are private to a library; other declarations are public unless export combinators hide them",
      declarations:
        "libraries, classes, mixins, enums, extensions, extension types, functions, variables, getters, setters, and typedefs",
      blockers: [
        "part files share one library-private namespace",
        "export/show/hide traversal and package URI resolution",
        "generated members and extension lookup",
      ],
      next: "Build and pin ABI-compatible WASM, then certify one library graph with part and export combinator resolution.",
    },
    {
      id: "scala",
      name: "Scala",
      kind: "programming-language",
      dialects: ["Scala 2", "Scala 3"],
      grammarRepository: "https://github.com/tree-sitter/tree-sitter-scala",
      grammarLicense: "MIT",
      wasm: "release-asset",
      wasmNotes: "The v0.26.2 release publishes tree-sitter-scala.wasm.",
      languageReference:
        "https://docs.scala-lang.org/scala3/reference/changed-features/access-modifiers.html",
      visibility:
        "public by default, with private/protected access qualifiers and Scala 3 private[this] migration behavior",
      declarations:
        "packages, classes, traits, objects, enums, definitions, values, variables, type members, givens, extensions, and exports",
      blockers: [
        "Scala 2 and Scala 3 surface differences",
        "package objects, givens, exports, and extension ownership",
        "compiler-generated case-class and enum members",
      ],
      next: "Choose explicit Scala dialect fixtures and certify source declarations without compiler-synthesized members.",
    },
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
      id: "elixir",
      name: "Elixir",
      kind: "programming-language",
      dialects: ["Elixir source"],
      grammarRepository: "https://github.com/elixir-lang/tree-sitter-elixir",
      grammarLicense: "Apache-2.0",
      wasm: "release-asset",
      wasmNotes: "The v0.3.5 release publishes tree-sitter-elixir.wasm.",
      languageReference: "https://hexdocs.pm/elixir/modules-and-functions.html",
      visibility:
        "def and defmacro are public while defp and defmacrop are private inside modules",
      declarations:
        "modules, public functions and macros by name/arity, protocols, implementations, typespecs, and module attributes",
      blockers: [
        "macros and use can generate arbitrary declarations",
        "aliases/imports affect name resolution",
        "protocol consolidation and generated documentation",
      ],
      next: "Certify explicit def/defmacro name-arity units and report declaration-generating macro boundaries as incomplete.",
    },
    {
      id: "erlang",
      name: "Erlang",
      kind: "programming-language",
      dialects: ["Erlang source", "Erlang header"],
      grammarRepository: "https://github.com/WhatsApp/tree-sitter-erlang",
      grammarLicense: "Apache-2.0",
      wasm: "source-build",
      wasmNotes:
        "The 0.20 release has no WASM asset; build WASM from a pinned source commit with the Tree-sitter CLI.",
      languageReference: "https://www.erlang.org/doc/system/modules.html",
      visibility:
        "functions and types become public through explicit export and export_type attributes keyed by name/arity",
      declarations:
        "modules, exported functions, exported types, records, callbacks, specifications, and macros",
      blockers: [
        "preprocessor macros and include files alter forms",
        "export_all and conditional compilation",
        "behaviour callbacks do not establish implementation exports",
      ],
      next: "Build and pin WASM, then resolve literal export attributes while treating preprocessing and export_all as explicit completeness boundaries.",
    },
    {
      id: "objective-c",
      name: "Objective-C",
      kind: "programming-language",
      dialects: ["Objective-C", "Objective-C++"],
      grammarRepository:
        "https://github.com/tree-sitter-grammars/tree-sitter-objc",
      grammarLicense: "MIT",
      wasm: "release-asset",
      wasmNotes: "The v3.0.2 release publishes tree-sitter-objc.wasm.",
      languageReference:
        "https://clang.llvm.org/docs/UsersManual.html#objective-c-language-features",
      visibility:
        "header declarations establish the consumable interface; ivars have access directives while methods and properties are exposed by interface/category/protocol declarations",
      declarations:
        "interfaces, implementations, protocols, categories, methods, properties, ivars, functions, variables, enums, and typedefs",
      blockers: [
        "header/include and preprocessor traversal",
        "category and class-extension identity merging",
        "selector spelling, Objective-C++ overlap, and linker visibility",
      ],
      next: "Certify explicit header interfaces and selector addresses first, with implementations, preprocessing, and Objective-C++ configured as separate boundaries.",
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
