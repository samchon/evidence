# Certified languages

`EvidenceLanguageRegistry.list()` is the authoritative set of shipped programming adapters. `evidence languages` renders the same records without loading a config or any grammar WASM. This release certifies ten programming languages; TSX is a TypeScript grammar variant and JSX uses the JavaScript grammar.

Each adapter produces the common programming symbols `type`, `function`, and `property`. Those names classify an Evidence obligation rather than reproduce every source language's terminology. Classes, interfaces, aliases, modules, namespaces, and similar declaration containers may be `type`; callable declarations are `function`; fields, constants, variables, enum values, and analogous data declarations may be `property` where the language contract includes them.

## Support matrix

| Type | Grammar and selected files | Certified public surface | Documentation and addressing |
| --- | --- | --- | --- |
| `typescript` | `typescript` for `.ts`, `.cts`, `.mts`; `tsx` for `.tsx` | Static module exports and declaration files within the selected snapshot | Attached JSDoc; file-qualified export accessors, with `prototype` for instance members |
| `javascript` | `javascript` for `.js`, `.jsx`, `.cjs`, `.mjs` | Static ESM exports and bounded unconditional CommonJS initialization | Attached JSDoc; file-qualified export accessors, with `prototype` for instance members |
| `python` | `python` for `.py`, `.pyi` | Statically declared module exports with bounded local import and `__all__` resolution | Docstrings or adjacent `#` documentation; file-qualified module accessors, with `prototype` for instance members |
| `go` | `go` for `.go` | Exported package declarations with package-wide receiver ownership | Adjacent line or block documentation; receiver and interface members below their owner type |
| `rust` | `rust` for `.rs` | Crate modules, public reexports, and local nominal implementation members in selected source | Outer/inner documentation or static doc attributes; public paths, with quoted `impl Trait` segments for trait implementations |
| `java` | `java` for `.java` | Source-public top-level and nested declarations, independent of JPMS exports | Attached Javadoc; package and owner accessors, with overloads grouped by owner and name |
| `csharp` | `c-sharp` for `.cs` | Source-public declarations and partial identities within one configured snapshot | Attached XML documentation; namespace and owner accessors with quoted generic arity, indexer, and operator segments |
| `c` | `c` for `.c`, `.h` | Explicit external declarations, tags, typedefs, aggregate fields, and enumerators within each physical file | Attached Doxygen; exact quoted tag names and unambiguous typedef or source-name aliases |
| `cpp` | `cpp` for `.cpp`, `.cc`, `.cxx`, `.c++`, `.C`, `.h`, `.hpp`, `.hh`, `.hxx`, `.h++`, `.H`, `.ipp`, `.tpp`, `.ixx`, `.cppm`, `.ccm`, `.cxxm`, `.c++m` | Explicit namespaces, public types and members, external declarations, templates, and bounded aliases across the selected snapshot | Attached Doxygen; namespace and owner accessors with quoted template arity and operator segments |
| `ruby` | `ruby` for `.rb`, `.rake`, `.gemspec`, `Gemfile`, `Rakefile` | Explicit classes/modules, public instance and singleton methods, constants, literal attributes, bounded aliases, and reopenings | Adjacent line or embedded RDoc; constant paths, direct instance ownership, and `self` for singleton members |

The configured `type` chooses the language before file selection. A `.h` file follows `type: "c"` or `type: "cpp"`; Evidence does not guess. Grammar selection then uses case-sensitive logical file names. A TypeScript `.tsx` file selects the TSX grammar within the one TypeScript adapter.

## Completeness boundaries

| Type | Boundaries that are not claimed as a complete public surface |
| --- | --- |
| `typescript` | Package exports, path aliases, ambient modules, global augmentations, and CommonJS export assignment |
| `javascript` | Dynamic CommonJS mutation, computed CommonJS keys, unsafe aliases, and application execution |
| `python` | Executed module discovery, dynamic `__all__` mutation, decorators or metaclasses that generate members, and imported dependency behavior |
| `go` | `GOOS`/`GOARCH` selection, promoted or dependency-derived members, and generated declarations absent from selected source |
| `rust` | Cargo feature evaluation, macro expansion, custom module paths, external type ownership, and generated declarations absent from selected source |
| `java` | JPMS export enforcement, annotation processors, compiler-generated record/enum methods, inherited members, and generated declarations absent from selected source |
| `csharp` | Conditional-compilation evaluation, explicit interface implementation units, source generators, compiler-generated record members, and inherited members |
| `c` | Preprocessor branch evaluation, macro expansion, include traversal, linker export policy, and generated declarations absent from selected source |
| `cpp` | Preprocessor evaluation, macro expansion, include traversal, specialization/instantiation, inheritance/friend lookup, modules, and linker visibility |
| `ruby` | Runtime load order, dynamic method or constant generation, mixins/refinements, eval-created declarations, and inherited members |

These boundaries do not all behave as silent exclusions. When the adapter can detect a construct that may change the configured public population but cannot resolve it safely, it marks the inventory incomplete and the check exits 2. Constructs outside the explicit declared-source contract, such as compiler-synthesized inherited members, are not invented as units.

Read the [adapter inventory guide](development/adapter-inventories.md) for exact declaration forms, merging, visibility, host attachment, aliases, and failure cases in each language.

## Artifact adapters

The programming-language count excludes three non-programming artifact adapters:

| Type | Units | Claim host |
| --- | --- | --- |
| `markdown` | File and ATX `h1` through `h4` sections | HTML comments attached to the file or nearest selected section |
| `prisma` | `model`, `column`, and `relation` | Triple-slash or supported block documentation attached to parsed schema declarations |
| `swagger` | `METHOD:/path` operations | Each operation's `description` |

Every implemented artifact family can be a claim and a reference. A Swagger reference names one exact local document or HTTP(S) URL; a Swagger claim uses local file globs. Prisma is the only implemented database adapter in this release.

## Parser assets

The package contains no grammar WASM. Each grammar manifest record pins the upstream repository, release, source commit, download URL, SHA-256 digest, byte length, and license; TypeScript and TSX use separate grammars. The runtime downloads a grammar into the per-user cache the first time a selected source needs it, verifies its length and digest on every read, and loads only grammars selected by active populations.

Consumers do not install per-language packages, download grammars by hand, or install a language compiler. A cold cache needs network access once; see the root README for the cache location and `EVIDENCE_CACHE_DIR`. Prisma uses `@prisma/prisma-schema-wasm`, and Swagger/OpenAPI uses local JSON/YAML parsing rather than Tree-sitter.

See [parser assets](development/parser-assets.md) for provenance and maintenance and [adapter onboarding](development/adapter-onboarding.md) for the certification gate.

## Candidate grammars

The repository researches additional grammars separately in [language candidates](development/language-candidates.md). A candidate is not supported because a grammar exists or parses a fixture. It becomes advertised only after its adapter defines and tests:

- exact semantic units and public addresses;
- visibility, ownership, aliases, and merged declarations;
- documentation hosts and unsupported false-positive locations;
- malformed and semantically incomplete inputs;
- fingerprints, ambiguity, and graph coverage;
- a pinned local grammar, license, and real parser fixture.

This gate keeps language counts tied to complete Evidence extraction rather than grammar availability.
