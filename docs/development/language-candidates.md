# Language candidate matrix

This matrix records implementation inputs for languages and embedded formats that are not yet supported. `EvidenceLanguageRegistry.candidates()` is the checked source of the same records. Grammar availability alone does not add a language to `EvidenceLanguageRegistry.list()`.

The current package certifies 10 programming languages through 11 packaged grammar variants. Markdown, Prisma, and Swagger/OpenAPI are three artifact formats outside that count. The 10 programming-language candidates and two embedded-format candidates below are also outside the supported count.

## Programming languages

### Kotlin (`kotlin`)

- Kind: `programming-language`; dialects: Kotlin source.
- Grammar: [tree-sitter-kotlin](https://github.com/tree-sitter-grammars/tree-sitter-kotlin), MIT, `release-asset`.
- WASM: The v1.1.0 release publishes tree-sitter-kotlin.wasm.
- Language reference: [visibility modifiers](https://kotlinlang.org/docs/visibility-modifiers.html).
- Visibility: public by default, with internal, protected, and private declarations plus file-private top-level members.
- Declarations: packages, classes, interfaces, objects, companions, functions, properties, constructors, type aliases, and extensions.
- Blockers: expect/actual and multiplatform source-set ownership; companion and extension receiver address policy; generated and delegated members.
- Next task: Certify explicit JVM-agnostic source declarations, companion ownership, overload families, and KDoc before resolving multiplatform exports.

### Swift (`swift`)

- Kind: `programming-language`; dialects: Swift source.
- Grammar: [tree-sitter-swift](https://github.com/alex-pinkus/tree-sitter-swift), MIT, `release-asset`.
- WASM: The 0.7.3 release publishes tree-sitter-swift.wasm.
- Language reference: [access control](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/accesscontrol/).
- Visibility: internal by default, with open, public, package, fileprivate, and private declarations.
- Declarations: modules, nominal types, protocols, extensions, functions, operators, properties, subscripts, and type aliases.
- Blockers: module and package boundaries come from build metadata; extensions merge declarations across files and modules; synthesized protocol and macro members.
- Next task: Define a configured module boundary and certify explicit public/open declarations, extensions, overloads, and DocC comments.

### PHP (`php`)

- Kind: `programming-language`; dialects: PHP with tags and PHP-only.
- Grammar: [tree-sitter-php](https://github.com/tree-sitter/tree-sitter-php), MIT, `release-asset`.
- WASM: The v0.24.2 release publishes tree-sitter-php.wasm and tree-sitter-php_only.wasm.
- Language reference: [visibility](https://www.php.net/manual/en/language.oop5.visibility.php).
- Visibility: top-level declarations are namespace-visible; class members use explicit visibility and default to public where PHP permits omission.
- Declarations: namespaces, classes, interfaces, traits, enums, functions, methods, properties, constants, and aliases.
- Blockers: PHP and PHP-only grammar dialect selection; Composer/autoload namespace topology; trait composition, conditional declarations, and runtime includes.
- Next task: Certify one namespace-local declared surface for both grammar dialects with trait and conditional boundaries reported as incomplete.

### Dart (`dart`)

- Kind: `programming-language`; dialects: Dart source.
- Grammar: [tree-sitter-dart](https://github.com/nielsenko/tree-sitter-dart), MIT, `source-build`.
- WASM: No upstream release asset is published; build WASM from a pinned source commit with the Tree-sitter CLI.
- Language reference: [libraries and visibility](https://dart.dev/language/libraries).
- Visibility: identifiers beginning with an underscore are private to a library; other declarations are public unless export combinators hide them.
- Declarations: libraries, classes, mixins, enums, extensions, extension types, functions, variables, getters, setters, and typedefs.
- Blockers: part files share one library-private namespace; export/show/hide traversal and package URI resolution; generated members and extension lookup.
- Next task: Build and pin ABI-compatible WASM, then certify one library graph with part and export combinator resolution.

### Scala (`scala`)

- Kind: `programming-language`; dialects: Scala 2 and Scala 3.
- Grammar: [tree-sitter-scala](https://github.com/tree-sitter/tree-sitter-scala), MIT, `release-asset`.
- WASM: The v0.26.2 release publishes tree-sitter-scala.wasm.
- Language reference: [access modifiers](https://docs.scala-lang.org/scala3/reference/changed-features/access-modifiers.html).
- Visibility: public by default, with private/protected access qualifiers and Scala 3 private[this] migration behavior.
- Declarations: packages, classes, traits, objects, enums, definitions, values, variables, type members, givens, extensions, and exports.
- Blockers: Scala 2 and Scala 3 surface differences; package objects, givens, exports, and extension ownership; compiler-generated case-class and enum members.
- Next task: Choose explicit Scala dialect fixtures and certify source declarations without compiler-synthesized members.

### Lua (`lua`)

- Kind: `programming-language`; dialects: Lua source.
- Grammar: [tree-sitter-lua](https://github.com/tree-sitter-grammars/tree-sitter-lua), MIT, `release-asset`.
- WASM: The v0.5.0 release publishes tree-sitter-lua.wasm.
- Language reference: [variables](https://www.lua.org/manual/5.4/manual.html#3.2).
- Visibility: lexical local declarations are explicit, but modules and public exports are conventions over globals and returned tables.
- Declarations: local/global functions and variables, table fields, and returned module tables.
- Blockers: the language has no normative module export declaration; table aliases and mutations are dynamic; require paths and loader behavior are environment-defined.
- Next task: Specify a bounded returned-table module convention before deciding whether Lua can claim a complete public inventory.

### Elixir (`elixir`)

- Kind: `programming-language`; dialects: Elixir source.
- Grammar: [tree-sitter-elixir](https://github.com/elixir-lang/tree-sitter-elixir), Apache-2.0, `release-asset`.
- WASM: The v0.3.5 release publishes tree-sitter-elixir.wasm.
- Language reference: [modules and functions](https://hexdocs.pm/elixir/modules-and-functions.html).
- Visibility: def and defmacro are public while defp and defmacrop are private inside modules.
- Declarations: modules, public functions and macros by name/arity, protocols, implementations, typespecs, and module attributes.
- Blockers: macros and use can generate arbitrary declarations; aliases/imports affect name resolution; protocol consolidation and generated documentation.
- Next task: Certify explicit def/defmacro name-arity units and report declaration-generating macro boundaries as incomplete.

### Erlang (`erlang`)

- Kind: `programming-language`; dialects: Erlang source and Erlang header.
- Grammar: [tree-sitter-erlang](https://github.com/WhatsApp/tree-sitter-erlang), Apache-2.0, `source-build`.
- WASM: The 0.20 release has no WASM asset; build WASM from a pinned source commit with the Tree-sitter CLI.
- Language reference: [modules](https://www.erlang.org/doc/system/modules.html).
- Visibility: functions and types become public through explicit export and export_type attributes keyed by name/arity.
- Declarations: modules, exported functions, exported types, records, callbacks, specifications, and macros.
- Blockers: preprocessor macros and include files alter forms; export_all and conditional compilation; behaviour callbacks do not establish implementation exports.
- Next task: Build and pin WASM, then resolve literal export attributes while treating preprocessing and export_all as explicit completeness boundaries.

### Objective-C (`objective-c`)

- Kind: `programming-language`; dialects: Objective-C and Objective-C++.
- Grammar: [tree-sitter-objc](https://github.com/tree-sitter-grammars/tree-sitter-objc), MIT, `release-asset`.
- WASM: The v3.0.2 release publishes tree-sitter-objc.wasm.
- Language reference: [Clang Objective-C language features](https://clang.llvm.org/docs/UsersManual.html#objective-c-language-features).
- Visibility: header declarations establish the consumable interface; ivars have access directives while methods and properties are exposed by interface/category/protocol declarations.
- Declarations: interfaces, implementations, protocols, categories, methods, properties, ivars, functions, variables, enums, and typedefs.
- Blockers: header/include and preprocessor traversal; category and class-extension identity merging; selector spelling, Objective-C++ overlap, and linker visibility.
- Next task: Certify explicit header interfaces and selector addresses first, with implementations, preprocessing, and Objective-C++ configured as separate boundaries.

### Zig (`zig`)

- Kind: `programming-language`; dialects: Zig source.
- Grammar: [tree-sitter-zig](https://github.com/tree-sitter-grammars/tree-sitter-zig), MIT, `release-asset`.
- WASM: The v1.1.2 release publishes tree-sitter-zig.wasm.
- Language reference: [`pub`](https://ziglang.org/documentation/master/#pub).
- Visibility: pub marks declarations available outside their container; unmarked declarations remain container-private.
- Declarations: containers, functions, variables, constants, fields, enum values, tests, comptime declarations, and usingnamespace imports.
- Blockers: comptime can generate or select declarations; usingnamespace changes the exported namespace; build options and generic instantiation affect reachable APIs.
- Next task: Certify explicit pub declarations and container ownership while reporting usingnamespace and declaration-producing comptime blocks as incomplete.

## Embedded formats

Embedded formats require source-region extraction and mapped host positions before a JavaScript or TypeScript adapter can analyze their scripts. Their template, style, and data regions do not inherit the programming symbol model from grammar presence.

### Vue single-file component (`vue`)

- Kind: `embedded-format`; dialects: Vue SFC.
- Grammar: [tree-sitter-vue](https://github.com/tree-sitter-grammars/tree-sitter-vue), MIT, `source-build`.
- WASM: No upstream release is published; build WASM from a pinned source commit with the Tree-sitter CLI.
- Language reference: [SFC syntax specification](https://vuejs.org/api/sfc-spec.html).
- Visibility: component contracts combine script/module exports, script setup macros, template bindings, styles, and custom blocks.
- Declarations: embedded JavaScript/TypeScript regions, component options, defineProps/defineEmits macros, templates, styles, and custom blocks.
- Blockers: embedded regions require offset-preserving extraction; script setup macros need Vue semantics; template and style grammars do not share a programming-symbol model.
- Next task: Implement source-region extraction and mapped host coordinates before delegating script blocks to JavaScript or TypeScript adapters.

### Svelte component (`svelte`)

- Kind: `embedded-format`; dialects: Svelte component.
- Grammar: [tree-sitter-svelte](https://github.com/sveltejs/tree-sitter-svelte), MIT, `source-build`.
- WASM: No upstream release is published; build WASM from a pinned source commit with the Tree-sitter CLI.
- Language reference: [Svelte files](https://svelte.dev/docs/svelte/svelte-files).
- Visibility: component contracts combine module/instance scripts, exported props or runes, markup, styles, and compiler-generated bindings.
- Declarations: embedded JavaScript/TypeScript regions, component props, module exports, markup, styles, and compiler directives.
- Blockers: embedded regions require offset-preserving extraction; Svelte version semantics change component exports; compiler-generated bindings are not explicit syntax declarations.
- Next task: Implement source-region extraction and mapped host coordinates before delegating script blocks to JavaScript or TypeScript adapters.
