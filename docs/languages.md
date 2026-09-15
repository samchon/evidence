# Certified languages

`EvidenceLanguageRegistry.list()` is the authoritative set of shipped programming adapters. `evidence languages` renders the same records without loading a config or any grammar WASM. This release certifies nineteen programming languages; TSX is a TypeScript grammar variant and JSX uses the JavaScript grammar. `EvidenceLanguageRegistry.databases()` lists the six Tree-sitter database schema languages certified alongside the Prisma parser.

Most programming adapters produce the common symbols `type`, `function`, and `property`. Those names classify an Evidence obligation rather than reproduce every source language's terminology. Classes, interfaces, aliases, modules, namespaces, and similar declaration containers may be `type`; callable declarations are `function`; fields, constants, variables, enum values, and analogous data declarations may be `property`. Lua exposes only `function` and `property` because its certified surface has no type declarations.

## Programming support matrix

| Type | Grammar and selected files | Certified public surface | Documentation and addressing |
| --- | --- | --- | --- |
| `typescript` | `typescript` for `.ts`, `.cts`, `.mts`; `tsx` for `.tsx` | Static module exports and declaration files within the selected snapshot | Attached JSDoc; file-qualified export accessors, with `prototype` for instance members |
| `javascript` | `javascript` for `.js`, `.jsx`, `.cjs`, `.mjs` | Static ESM exports and bounded unconditional CommonJS initialization | Attached JSDoc; file-qualified export accessors, with `prototype` for instance members |
| `python` | `python` for `.py`, `.pyi` | Final statically declared module bindings with bounded local import and `__all__` resolution | Docstrings or adjacent `#` documentation; file-qualified module accessors, with `prototype` for instance members |
| `go` | `go` for `.go` | Exported package declarations with package-wide receiver ownership | Adjacent line or block documentation; receiver and interface members below their owner type |
| `rust` | `rust` for `.rs` | Crate modules, public reexports, and local nominal implementation members in selected source | Outer/inner documentation or static doc attributes; public paths, with quoted `impl Trait` segments for trait implementations |
| `java` | `java` for `.java` | Source-public top-level and nested declarations, independent of JPMS exports | Attached Javadoc; package and owner accessors, with overloads grouped by owner and name |
| `csharp` | `c-sharp` for `.cs` | Source-public declarations and partial identities within one configured snapshot | Attached XML documentation; namespace and owner accessors with quoted generic arity, indexer, and operator segments |
| `c` | `c` for `.c`, `.h` | Explicit external declarations, tags, typedefs, aggregate fields, and enumerators within each physical file | Attached Doxygen; exact quoted tag names and unambiguous typedef or source-name aliases |
| `cpp` | `cpp` for common C++ source, header, template, and module-interface extensions | Explicit namespaces, public types and members, external declarations, templates, and bounded aliases across the selected snapshot | Attached Doxygen; namespace and owner accessors with quoted template arity and operator segments |
| `ruby` | `ruby` for `.rb`, `.rake`, `.gemspec`, `Gemfile`, `Rakefile` | Explicit classes/modules, public instance and singleton methods, constants, literal attributes, bounded aliases, and reopenings | Adjacent line or embedded RDoc; constant paths, direct instance ownership, and `self` for singleton members |
| `kotlin` | `kotlin` for `.kt` | Public-by-default declarations, overload families, primary-constructor properties, companions, and extensions on resolvable receivers | Adjacent KDoc before annotations; package-qualified accessors with `Companion` and quoted `extension(...)` segments |
| `swift` | `swift` for `.swift` | Public/open declarations of one module per population root, with extensions merged under their selected nominal owner | Adjacent `///` runs or `/** */` DocC; lexical owner accessors with `init`, `subscript`, and `static` segments, overloads sharing one identity |
| `php` | `php` for `.php` | Namespace declarations and public class members in tagged PHP blocks, with property hooks belonging to their property | Adjacent PHPDoc across attributes; namespace accessors with `$`-prefixed property segments |
| `dart` | `dart` for `.dart`, including selected generated `.g.dart` | Non-underscore library declarations across selected `part` and static relative `export` graphs, with getter/setter pairs sharing one property | Adjacent `///` groups or `/** */`; lexical owner accessors such as `Contract.new` and `Contract["operator +"]` |
| `scala` | `scala` for `.scala` | Unrestricted Scala 2 and Scala 3 declarations, overload families, named givens, and explicit singleton-object exports | Adjacent Scaladoc; package accessors with quoted `object` and `package object` owner segments |
| `lua` | `lua` for `.lua` | Explicit globals and one returned literal module table with resolved local aliases; `function` and `property` only, `type` selectors are rejected | Adjacent `---` LuaDoc groups or long `--[[ ]]` comments; `module` root accessor with literal string-key segments, colon methods sharing the dot field address |
| `matlab` | `matlab` for `.m` | `classdef` types, primary functions, public methods, properties, enumeration members, and events, including `@Class` folder methods | Percent help comments after signatures or before members; `+pkg` package segments and class-owned members such as `Widget.Widget` |
| `objc` | `objc` for `.m`, `.h` | Interfaces, protocols, named categories, methods, external C functions, properties, and `@public` ivars merged across matching declarations | Adjacent Doxygen blocks or `///`/`//!` lines; quoted selector segments such as `["-send:to:"]`, `["Widget(Extras)"]`, and `["protocol(Widget)"]` |
| `zig` | `zig` for `.zig` | Explicit `pub` declarations, exposed container fields and cases, and same-container direct aliases | Adjacent `///`; lexical owner accessors with quoted identifier segments |

The configured `type` chooses the language before file selection. A `.h` file follows `type: "c"`, `type: "cpp"`, or `type: "objc"`, and a `.m` file follows `type: "objc"` or `type: "matlab"`; Evidence does not guess. Grammar selection then uses case-sensitive logical file names. A TypeScript `.tsx` file selects the TSX grammar within the one TypeScript adapter.

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
| `kotlin` | Overrides without explicit visibility, `expect`/`actual`, public delegation, unresolved or generic extension receivers, `.kts` scripts, and compiler-generated members |
| `swift` | Build-metadata module boundaries, macros, conditional compilation, constrained or external extensions, extension-added conformances, and synthesized members |
| `php` | Trait composition, declarations inside executable blocks, `include`/`require`/`eval`, `define`, `class_alias`, autoload metadata, and computed or undeclared `$this` properties |
| `dart` | Package or SDK export URIs, conditional exports, augmentations, missing parts or exports, competing exported definitions, and inherited or implicit members |
| `scala` | Anonymous givens, `derives`, macros, structural types, implicit conversion, companion merging, chained or wildcard exports, and compiler-synthesized case-class or enum members |
| `lua` | Metatables, `require` loaders, chunk-level control flow, table cycles, reassignment, shadowing, field replacement or deletion, and tables escaping through calls or returns |
| `matlab` | `dynamicprops`, `eval`/`evalin`/`assignin`/`feval`/`str2func`, legacy `class` construction, unknown attributes, missing class folders or implementations, and inherited members |
| `objc` | Header traversal, non-guard preprocessing, macro expansion, computed includes, C typedefs and aggregates, Objective-C++, and inherited or synthesized members |
| `zig` | `usingnamespace`, qualified aliases, imported namespaces, comptime namespace blocks, type-producing functions, inferred declaration types, and build options |

These boundaries do not all behave as silent exclusions. When an adapter detects a construct that may change the configured public population but cannot resolve it safely, it marks the inventory incomplete and the check exits 2. Constructs outside the explicit declared-source contract, such as compiler-synthesized inherited members, are not invented as units.

Read the [adapter inventory guide](development/adapter-inventories.md) for exact declaration forms, merging, visibility, host attachment, aliases, and failure cases. The registry and `evidence languages` remain authoritative when prose and executable metadata disagree.

## Database schema languages

Database adapters share the `model`, `column`, and `relation` symbols and the `IEvidenceDatabaseClaim` and `IEvidenceDatabaseReference` typings. The configured `type` selects the schema language; `.sql` files never infer a dialect from parsing.

| Type | Grammar and selected files | Units | Documentation and addressing |
| --- | --- | --- | --- |
| `prisma` | `@prisma/prisma-schema-wasm`, preferring a parser visible from the project root | Models and views as `model`; parser output decides `column` versus `relation`; enums, composite types, indexes, generators, and datasources add none | Triple-slash or supported block documentation attached to parsed declarations |
| `postgresql` | `sql` for `.sql` | Explicit `schema.table` tables, columns, and foreign keys, plus unconditional `ALTER TABLE ADD COLUMN` and named `ADD CONSTRAINT` sites | Adjacent `--` or block comments and `COMMENT ON TABLE`/`COLUMN`; unquoted identifiers fold to lowercase, named keys use `["constraint owner_fk"]` |
| `mysql` | `mysql` for `.sql` | Unconditional `CREATE TABLE` tables, explicit columns, and table `FOREIGN KEY` relations; inline `REFERENCES` adds none | Adjacent `--` or block comments and table or column `COMMENT` strings; source-spelled database and table segments with `foreign-key:` literal segments |
| `sqlite` | `sqlite` for `.sql`, `.sqlite` | `CREATE TABLE` models, declared columns, and inline or table foreign keys, with `main` and `temp` schema aliases | Leading `--` runs or one adjacent block comment; `["foreign key:name"]` for named keys and JSON-encoded anonymous keys |
| `bigquery` | `bigquery` for `.sql`, `.bqsql` | Explicit `CREATE TABLE` tables, scalar, repeated, and nested `STRUCT` fields, and `NOT ENFORCED` foreign keys | Leading `--`, `#`, or block comments and static `OPTIONS(description=...)`; backticked `project.dataset.table` paths split into segments |
| `sql` | `sql` for `.sql` | Portable unconditional `CREATE TABLE` with standard scalar types, inline `REFERENCES`, and anonymous table-level `FOREIGN KEY` | Leading `--` runs or adjacent block comments; uppercase regular identifiers, literal quoted identifiers, and `foreign-key:[...]->[...]([...])` segments |
| `dbml` | `dbml` for `.dbml` | Tables, scalar fields, and inline or standalone `Ref` relations owned by one table; enums and indexes add none | Table and column notes or adjacent standalone comments; `public` default schema, alias addresses, and `$ref:` relation segments |

The SQL dialects treat the selected files as a declared schema snapshot: migrations, `ALTER` beyond the PostgreSQL forms above, `DROP`, views, query-derived or conditional tables, and other executable statements leave analysis incomplete. DBML reports partial definitions, table groups, and imports as incomplete. No adapter executes SQL or inspects a running database; the root README states each dialect's exact accepted subset.

## Artifact adapters

The language counts exclude two non-programming artifact adapters:

| Type | Units | Claim host |
| --- | --- | --- |
| `markdown` | File and ATX `h1` through `h4` sections | HTML comments attached to the file or nearest selected section |
| `swagger` | `METHOD:/path` operations | Each operation's `description` |

Every implemented artifact family can be a claim and a reference. A Swagger reference names one exact local document or HTTP(S) URL; a Swagger claim uses local file globs.

## Parser assets

The package contains no grammar WASM. Each grammar manifest record pins the upstream repository, release, source commit, download URL, SHA-256 digest, byte length, and license; TypeScript and TSX use separate grammars. The runtime downloads a grammar into the per-user cache the first time a selected source needs it, verifies its length and digest on every read, and loads only grammars selected by active populations.

Consumers do not install per-language packages, download grammars by hand, or install a language compiler. A cold cache needs network access once; see the root README for the cache location and `EVIDENCE_CACHE_DIR`. Prisma uses `@prisma/prisma-schema-wasm`, and Swagger/OpenAPI uses local JSON/YAML parsing rather than Tree-sitter.

See [parser assets](development/parser-assets.md) for provenance, acquisition, cache, and maintenance rules and [adapter onboarding](development/adapter-onboarding.md) for the certification gate.

## Candidate grammars

The repository researches additional grammars separately in [language candidates](development/language-candidates.md). A candidate is not supported because a grammar exists or parses a fixture. It becomes advertised only after its adapter defines and tests:

- exact semantic units and public addresses;
- visibility, ownership, aliases, and merged declarations;
- documentation hosts and unsupported false-positive locations;
- malformed and semantically incomplete inputs;
- fingerprints, ambiguity, and graph coverage;
- a pinned downloadable grammar, its license, and a real parser fixture.

This gate keeps language counts tied to complete Evidence extraction rather than grammar availability.
