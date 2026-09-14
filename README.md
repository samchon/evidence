# @wrtnlabs/evidence

An Evidence Graph connects specifications, engineering principles, public code contracts, and tests through explicit citations. `@wrtnlabs/evidence` checks that every selected requirement has evidence or a permitted exclusion, and that every citation names a valid target and explains its relationship.

The configuration and graph semantics follow [`@ttsc/evidence`](https://github.com/samchon/ttsc/tree/14a22f077caf23f1bfb8a97b3d9db765912074ef/packages/evidence), with programming-language declarations selected from files through Tree-sitter. The [compatibility ledger](https://github.com/wrtnlabs/evidence/blob/master/docs/development/compatibility.md) records preserved behavior, standalone translations, and compiler-dependent boundaries.

## Installation

```bash
pnpm i -D typescript ttsc @wrtnlabs/evidence
```

`typescript` and `ttsc` are required peers supplied by the consumer. The `ttsx` executable comes from `ttsc` and evaluates `evidence.config.ts`.

Follow the [getting-started guide](https://github.com/wrtnlabs/evidence/blob/master/docs/getting-started.md) to create one failing obligation, repair it with a real citation, and add an implementation-to-test edge.

## Guides

- [Evidence Graph contract](https://github.com/wrtnlabs/evidence/blob/master/docs/evidence-graph.md)
- [Configuration reference](https://github.com/wrtnlabs/evidence/blob/master/docs/configuration.md)
- [Tags and targets](https://github.com/wrtnlabs/evidence/blob/master/docs/tags-and-targets.md)
- [CLI reference](https://github.com/wrtnlabs/evidence/blob/master/docs/cli.md)
- [Certified languages](https://github.com/wrtnlabs/evidence/blob/master/docs/languages.md)
- [Migration from `@ttsc/evidence`](https://github.com/wrtnlabs/evidence/blob/master/docs/migration-from-ttsc.md)

## Configuration

Create `evidence.config.ts` at the project root:

```ts
import type { IEvidenceConfig } from "@wrtnlabs/evidence";

const config: IEvidenceConfig = {
  severity: "error",
  claims: [
    {
      type: "typescript",
      files: ["src/**"],
      reference: {
        type: "markdown",
        files: ["docs/requirements.md"],
        symbol: "h2",
      },
    },
    {
      type: "typescript",
      files: ["test/**"],
      symbol: "function",
      reference: {
        type: "typescript",
        files: ["src/**"],
        symbol: "function",
        noEvidenceExclude: true,
      },
    },
  ],
};

export default config;
```

A **claim** selects the files and declarations that must cite evidence. Its **reference** selects what must be covered. Each claim and each element of its reference array has an independent coverage obligation; partial coverage from separate obligations is never pooled.

Use `type` to select the source language, such as `"typescript"`, `"cpp"`, or `"rust"`, and `files` to select its files with globs. File names distinguish syntax variants such as TSX. No separate `language` setting or TypeScript compiler Program is required. `EvidenceDatabaseType` reserves a shared database type family, but Prisma is the only certified database adapter in this release; SQL dialect and DBML identifiers are rejected until their adapters are implemented and certified.

Globs resolve from the directory containing `evidence.config.ts`, or from the population's `root`. Patterns are applied in order: `!` excludes matches, and a later positive pattern can include them again. Use `src/**` to select a directory's contents.

Run the checker from the project root:

```bash
pnpm exec evidence
```

`evidence` and `evidence check` evaluate the same complete graph. Use `evidence init` to create a small typed starter configuration; it refuses to overwrite an existing file and changes no other project file.

```bash
pnpm exec evidence init
pnpm exec evidence check --format json --output reports/check-report.json
pnpm exec evidence check --watch
pnpm exec evidence list --language typescript --kind function
pnpm exec evidence inspect 'src/calculator.ts#add' --format json
pnpm exec evidence graph --format mermaid --output reports/evidence.mmd
pnpm exec evidence languages
```

| Option | Commands | Behavior |
| --- | --- | --- |
| `-c, --config <path>` | check, list, inspect, graph, init | Select a config instead of `evidence.config.ts`. |
| `--cwd <path>` | check, list, inspect, graph, languages, init | Resolve CLI paths from another directory. Population roots still resolve from the config file. |
| `--format text\|json` | check, list, inspect, languages | Select human-readable or versioned machine output. |
| `--format json\|mermaid\|dot` | graph | Select the lossless graph report or a visual graph syntax. |
| `-o, --output <path>` | check, list, inspect, graph, languages | Write command output to an explicit path instead of stdout. |
| `--language <type>` | list | Keep only rows from one certified artifact type. |
| `--kind <symbol>` | list | Keep only rows with one common symbol kind. |
| `-h, --help` | all | Print help without loading a config or project. |
| `-v, --version` | root | Print the package version without loading a config or project. |
| `-w, --watch` | check | Run an initial check, then recheck after active dependencies change. |

The [CLI reference](https://github.com/wrtnlabs/evidence/blob/master/docs/cli.md) gives each command's accepted options, output contract, and failure status.

### Dart

`EvidenceDartAdapter` analyzes selected `.dart` files, including supplied generated `.g.dart` source, with a pinned `tree-sitter-dart` grammar. Classes, mixins, enums, named extensions, extension types, and typedefs are `type` units. Explicit functions, methods, class-body constructors, and operators are `function` units. Variables, fields, enum constants, extension-type representation fields, and getter/setter pairs are `property` units. Undocumented declarations remain selected. Names beginning with `_`, their descendants, and unnamed extensions remain library-private. Inherited members, implicit constructors, and other compiler-generated members absent from source do not create units.

Addresses use lexical names such as `api.dart#Contract.value`, `api.dart#Numbers.twice`, `api.dart#Contract.new`, and `api.dart#Contract.named`. Operators retain a literal segment such as `api.dart#Contract["operator +"]`. Static and instance members both live directly under their declared owner. Complementary getters and setters share one property identity with separate declaration sites; other conflicting definitions make analysis incomplete. Typedefs are independent type declarations and do not expand the aliased type's members. Separate defining libraries retain separate identities even when they declare the same name. An extension type's primary constructor is represented by its type declaration; its representation field is a separate property.

Select the whole relevant library graph in each population. Relative `part` and URI or named `part of` directives must agree on one selected defining library. Library files share public addresses without duplicating units. Static relative exports add transitive aliases and apply ordered `show`/`hide` combinators to root names; a local declaration shadows the same exported name, while competing exported definitions are incomplete. An export combinator only filters that export address: a declaration in another selected source remains an obligation at its defining library. Missing parts and exports retain exact watch dependencies and make analysis incomplete. Package or SDK export URIs, conditional exports, escaped or interpolated directive URIs, and augmentations require additional resolution and are reported as incomplete. Imports do not publish declarations, and external package imports do not imply traversal or member synthesis.

Adjacent `///` groups and `/** */` documentation attach to the following declaration, including metadata inside its syntax node. Ordinary comments and strings cannot acknowledge evidence; annotation-like text there receives an unsupported-host diagnostic. Fenced, indented, and HTML code examples inside documentation are inert. Withdrawal tags hide the attached declaration and descendants. Documentation mappings preserve original UTF-16 positions, including Unicode and CRLF, and annotation-only edits preserve review fingerprints.

### Watch mode

Run `pnpm exec evidence check --watch` or use `-w` while authoring. The watcher publishes an initial cycle, polls active filesystem dependencies every 250 milliseconds, waits for a 100-millisecond quiet period after a change, and serializes complete reevaluations. Each published result comes from a fresh configuration load, source inventory, parse, and graph evaluation. If a dependency changes during that work or the new analysis discovers an additional dependency, the superseded result is discarded and reevaluated before publication.

The active set includes `evidence.config.ts`, its static runtime import/export chain, configured glob directories and matching files, module metadata and re-export inputs reported by adapters, exact Markdown, Prisma, and local Swagger inputs, and logical and physical link paths. Missing files and roots remain dependencies so their creation can repair a cycle. A failed config keeps the last active set plus every dependency found in the current config scan; it never reuses the old config value. Disabled claims, effective `off` claims, and `off` references create no artifact reads or watch inputs.

Configuration dependency discovery accepts static import/export specifiers and literal `import()` or `require()` calls. A computed runtime module specifier cannot be watched completely and produces a failed watch cycle until it is made static. Each local filesystem change also refetches enabled remote Swagger references during the fresh check. Remote URLs are not polled independently, so a remote-only change does not create a cycle.

Text output prints every cycle and keeps failures visible until another dependency change triggers recovery. JSON output is NDJSON: each line is one compact `schemaVersion: 1` object with `watch: true`, a sequential `cycle`, status, exit code, and either the complete check report or an operational failure. `--output` truncates its destination once when watch starts and appends each framed cycle. Cycle exit codes describe that result while the process stays alive; Ctrl+C requests cleanup and exits 0, and an output or watcher failure exits 2.

`EvidenceWatcher` exposes the same loop for embedding. Its optional `pollIntervalMilliseconds` and `debounceMilliseconds` settings change the two default intervals, `watch(callback)` awaits asynchronous publication, `dependencies()` returns the current active set, and `close()` requests shutdown. The watcher retains no syntax tree, inventory, graph, or fingerprint cache between cycles. Tree-sitter grammar modules remain immutable process-wide assets, while each analysis releases its bounded parsers, trees, and queries.

`evidence list` prints every selected unit and addressable aggregate ancestor in each configured claim/reference scope. Every row carries its stable semantic identity, canonical target, public aliases, symbol kind, and declaration locations. `--language` and `--kind` filter these rows after the complete graph has been evaluated, so they do not change any coverage denominator or check result.

`evidence inspect <target>` resolves the target with the same inventories and exact resolver used by checking. It reports ambiguity, withdrawal, or incomplete analysis instead of guessing; a resolved identity includes aliases, children, obligation state, incoming acknowledgements and exclusions, reviews, host provenance, and its current fingerprint. Code paths entered at the command line and printed by list are relative to `--cwd`. Paths inside source `@evidence` and review annotations remain relative to their own citing file.

`evidence graph` preserves each claim/reference obligation as an independent boundary. Its edges retain acknowledgement kind, while reviews remain separate relations. JSON is the authoritative lossless format. Mermaid and DOT use generated node identifiers and escape source-controlled labels so paths, quotes, line breaks, and graph operators remain label data.

`evidence languages` reads the shipped language registry without loading `evidence.config.ts`. It reports grammar file patterns, symbol coverage, public-surface and documentation policies, and unsupported capabilities for certified adapters. Grammar-only candidates are omitted.

Text and JSON contain the same deterministic findings and coverage counts. JSON reports use `schemaVersion: 1`, identify the config and original claim/reference indexes, and distinguish `complete`, `incomplete`, and operationally `failed` analysis. Config output and operational messages use stderr, so JSON stdout remains parseable. When `--output` is present, stdout stays empty; an unwritable destination is an explicit command failure.

The process exits with 0 after complete analysis without error-severity findings, including a warning-only result. It exits with 1 after complete analysis with Evidence errors, and 2 for invalid CLI/configuration or incomplete source and parser analysis. `severity: "off"` and `disabled: true` populations are skipped before source loading; they do not count as completed coverage.

For programmatic loading, import `EvidenceConfigLoader` from `@wrtnlabs/evidence` and call `await EvidenceConfigLoader.load("evidence.config.ts")`. It returns the validated `IEvidenceConfig` with authored optional values intact. `EvidenceConfigLoader.plan()` additionally resolves severity and symbol defaults into an `IEvidenceConfigPlan` containing only populations that may load artifacts. Both methods default to `evidence.config.ts` in the current working directory.

`EvidenceChecker.check(configFile)` runs configuration loading, source discovery, adapter analysis, target resolution, and graph evaluation, then returns `IEvidenceCheckReport`. `EvidenceChecker.analyze(configFile)` returns the report together with its exact `IEvidenceGraphInput` and materialized `IEvidenceGraphResult`; `EvidenceChecker.evaluate(plan)` provides the same analysis for an already validated plan. `EvidenceQuery` derives list, inspection, language, and graph reports from that model. `EvidenceReporter`, `EvidenceQueryReporter`, and `EvidenceGraphReporter` render the corresponding output forms.

Use `new EvidenceChecker(configFile)` for repeated checks; each `analyze()`, `check()`, or `evaluate(plan)` call creates an independent execution context. Use `new EvidenceQuery(analysis, cwd)` to run `list(language?, kind?)`, `inspect(target)`, and `graph()` against one captured analysis with shared population indexes. Query reports are independent copies, so modifying an input or returned report does not change subsequent queries. Create a new query instance after obtaining a new analysis. The static methods remain available for individual operations.

`new EvidenceGraph(input).evaluate()` and `new EvidenceTagParser(content, host, documentation).parse()` capture their inputs and create fresh evaluation or parsing state for each call. Their static `evaluate(input)` and `parse(content, host, documentation)` methods provide the same individual operations.

The loader checks the configuration and its imports through the consumer's `ttsx`, then applies `typia.assert<IEvidenceConfig>` to the default export. Compiler and runtime failures reject the promise, and evaluator logs go to stderr. Every declaration is validated before activation, so `disabled` and `off` cannot conceal a malformed population. A disabled claim, a claim whose effective severity is `off`, and a claim with no enabled reference are absent from the plan; an `off` reference is absent from its claim.

For direct local source access, `EvidenceSourceLoader.glob(configFile, { root, files })` loads an enabled population, and `EvidenceSourceLoader.file(configFile, file, root)` loads one exact local path. Relative roots resolve from the configuration file's directory; file globs run left to right, including exclusions and later reinclusions. A bare directory selects no children; use `directory/**`.

Source snapshots retain UTF-8 contents, byte digests, physical file identities, every selected logical address, and filesystem dependencies for detecting changes. Directory links and hard links share physical files without losing their addresses. Always inspect `complete` and `diagnostics`: a healthy empty selection is complete, while an inaccessible root, cyclic link, or unreadable file makes the snapshot incomplete. Invalid root or glob syntax rejects the promise. Discovery retains all selected formats for adapter processing; filesystem completeness alone does not establish parser support or evidence coverage.

`EvidenceMarkdownAdapter.analyze(snapshot)` turns a Markdown snapshot into file and ATX H1-H4 units, public file/anchor addresses, section ownership, HTML-comment hosts, acknowledgements, and reviews. It retains discovery failures and reports whitespace paths, unresolved heading anchors, annotations below H5/H6, and tag lines rendered as prose. Fenced, indented, HTML `<pre>`, and MDX template examples do not produce annotations.

For direct syntax analysis, use `EvidenceParser.parse(input, callback)`. The callback receives a borrowed tree and query helpers; copy extracted values into ordinary data before it returns:

```ts
import { EvidenceParser } from "@wrtnlabs/evidence";

const parser = new EvidenceParser();
try {
  const names = await parser.parse(
    {
      type: "typescript",
      file: "calculator.ts",
      content: "export function add(a: number, b: number) { return a + b; }",
    },
    (session) =>
      session
        .captures("(function_declaration name: (identifier) @name)")
        .map((capture) => capture.node.text),
  );
  console.log(names);
} finally {
  await parser.close();
}
```

The runtime automatically downloads the pinned grammar when a selected source first needs it, verifies its byte length and SHA-256, and stores it in a per-user cache. Evidence contains no language grammar WASM files. Consumers need no per-language installation, manual download, or native compilation. The core runtime comes from the `web-tree-sitter` dependency. Each parse owns its parser, tree, and query cache. `concurrency` limits live sessions and defaults to four; `close()` waits for accepted callbacks and prevents new requests. A callback must not await another parse or close on the same runtime. Syntax errors, missing tokens, incompatible queries, and truncated query results throw `EvidenceParserError` with a stable `code` instead of returning incomplete captures. `session.range(node)` produces a half-open span with zero-based UTF-16 offsets and one-based lines and UTF-16 columns in the original source string.

A cold cache requires network access. Verified cached grammars work offline without network requests, and damaged entries are downloaded again automatically. The default cache is `%LOCALAPPDATA%/wrtnlabs/evidence/Cache` on Windows, `~/Library/Caches/wrtnlabs/evidence` on macOS, and `$XDG_CACHE_HOME/wrtnlabs/evidence` or `~/.cache/wrtnlabs/evidence` on Linux. Set `EVIDENCE_CACHE_DIR` to an absolute writable directory to override it; keep this directory outside selected source roots. Cache entries use `grammars-v1/<sha256>.wasm` and are verified on every read.

Concurrent callers share downloads, and cache files are published atomically. Transient failures receive up to three attempts with a 30-second deadline per attempt; permanent HTTP failures and checksum mismatches fail immediately. Preparation failures leave analysis incomplete with exit code 2. CLI preparation messages go to stderr and are suppressed with `--output`. Watch retries parser acquisition failures after five seconds even without a source edit; `parserRetryMilliseconds` changes that interval. Imports, configuration loading, help, version, init, and language metadata do not download source grammars. TypeScript configuration dependency scanning in watch also uses the pinned TypeScript grammar.

`EvidenceLanguageRegistry.list()` reports eleven certified programming languages: TypeScript, JavaScript, Python, Go, Rust, Java, C#, C, C++, Ruby, and Kotlin. Syntax variants remain explicit: `.h` follows the configured `c` or `cpp` type, `.tsx` selects the TSX grammar within TypeScript, and JSX shares the JavaScript grammar. `select(type, file)` uses the configured language and case-sensitive logical file name. `parser.grammars()` reports pinned asset provenance without loading WASM; `parser.state()` exposes the instance's loaded grammar IDs and active/queued session counts. Grammar metadata alone does not establish public export resolution or graph coverage.

For adapter development, `IEvidenceAdapter.analyze(snapshot)` returns an ordinary `IEvidenceInventory`. `new EvidenceInventory(inventories)` combines adapter-established identities, checks declaration ownership and original source coordinates, and reconciles withdrawal across merged declarations. `select(ids)` returns an independent population with its structural ancestors and eligible hosts; `resolve({ file, segments }, ids)` looks up an exact public address inside that scope. Check `complete` and `diagnostics` before using a population. Reviews have a separate collection and never supply acknowledgements. New languages require adapter certification and a pinned downloadable grammar that parses real declarations through the shared runtime.

`EvidenceDocumentation.read()` maps a classified comment into its original source, and `EvidenceTagParser.parse()` reads acknowledgements, exclusions, reviews, and withdrawal markers from that mapped text. Adapters establish comment identity and attachment before invoking these helpers. `EvidenceAccessor.parse()` and `format()` preserve literal member segments such as `SomeClass["field.name"]`. See the [adapter inventory guide](https://github.com/wrtnlabs/evidence/blob/master/docs/development/adapter-inventories.md) for ownership, completeness, and documentation contracts.

## Artifacts and symbol selectors

| Artifact | Claim | Reference | Symbol selectors | Default claim / reference |
| --- | --- | --- | --- | --- |
| Programming | Yes | Yes | `type`, `function`, `property` | All / `type` |
| Markdown | Yes | Yes | `file`, `h1`, `h2`, `h3`, `h4` | All / all |
| Prisma | Yes | Yes | `model`, `column`, `relation` | All / `model` |
| Swagger / OpenAPI | Yes | Yes | `operation` | Every operation / every operation |

Every artifact family can cite every other family, including its own. Markdown can cite programming declarations or Swagger operations, and Swagger operations can cite Markdown, programming declarations, database schemas, or other operations.

A `symbol` accepts one selector or a nonempty array. Programming `type` symbols include classes, interfaces, type aliases, and namespaces. Database `model` symbols describe record structures, `column` symbols describe data fields, and `relation` symbols describe connections between models. A foreign-key value is a column; the declaration describing its connection is a relation.

Database schema typings share `IEvidenceDatabaseClaim` and `IEvidenceDatabaseReference`. Prisma is the implemented database adapter. Select the schema language rather than the database server: MongoDB models written in Prisma use `type: "prisma"`.

Prisma files selected for one population are parsed together with `@prisma/prisma-schema-wasm`, which ships with this package. Evidence first uses a parser version visible from the project root and falls back to its pinned copy, so consumers do not install a separate Prisma parser. Parser output decides whether a member is a column or relation; the source scanner only supplies locations and documentation attachment. Views are model units, while enums, composite types, indexes, generators, and datasources do not form units.

`EvidenceJavaScriptAdapter` parses `.js`, `.jsx`, `.mjs`, and `.cjs` with the pinned JavaScript grammar. `.mjs` always uses ESM and `.cjs` always uses CommonJS. A `.js` or `.jsx` file follows the nearest `package.json` `type`; missing metadata defaults to CommonJS. Checked package paths become watch dependencies, and unreadable, malformed, unsupported, or conflicting metadata leaves the inventory incomplete.

Exported classes are `type` units. Functions, generators, function-valued `const` declarations, methods, and function-valued class fields are `function` units; other exported values and public fields are `property` units. Static members use `Class.member`, while instance members use `Class.prototype.member`. Constructors, accessors, private fields, and computed member names do not form units. Anonymous default classes, functions, function expressions, and values use the public `default` address.

JavaScript ESM follows direct exports, aliases, defaults, imported bindings that are re-exported, named and star reexports, namespace exports, explicit shadowing, ambiguity, and finite cycles through relative snapshot files. CommonJS accepts unconditional top-level `exports.name = local`, `module.exports.name = local`, `module.exports = local`, and `module.exports = { name, alias: local }`. Replacing `module.exports` clears earlier names and detaches `exports`; `exports = module.exports` reconnects it. Computed keys, conditional mutation, dynamic replacement, inline values, shadowed bindings, and escaped aliases make analysis incomplete.

Only attached JSDoc carries JavaScript evidence, exclusions, or reviews. JSX text, strings, templates, regular expressions, line comments, ordinary block comments, and detached JSDoc do not create evidence edges. Exported declarations without JSDoc remain policy hosts.

`EvidencePythonAdapter` parses `.py` and `.pyi` with the pinned Python grammar. Module classes and explicit type aliases are `type` units; functions, async functions, and methods are `function` units; simple module/class assignments and direct `self.name` assignments in `__init__` are `property` units. Nested classes retain their owners. Static and class methods use `Class.member`; ordinary methods, property-decorated methods, and instance fields use `Class.prototype.member`. Leading-underscore class members and special methods are excluded. An underscored module declaration can still be exported explicitly through `__all__`.

A static `__all__` accepts literal string lists or tuples, `+` composition, and top-level `+=` additions. Without `__all__`, supported module declarations and statically resolved imported bindings are public unless their local name starts with an underscore. Relative imports resolve from the importing package directory; absolute imports resolve from the configured population root. Resolution follows local `.py`, `.pyi`, and package `__init__` modules already present in the source snapshot, including aliases, namespace imports, star imports, and finite cycles. Missing local sources, unresolved explicit names, conditional public declarations, and dynamic `__all__` mutation leave analysis incomplete.

Python evidence can live in a real class or function docstring, or in a same-indent `#` comment run immediately before a supported declaration. A comment before decorators attaches across the decorator list. Assigned and otherwise arbitrary strings, module docstrings, detached comments, and local nested helpers do not become public evidence hosts. Decorators, imports, metaclasses, module initialization, and dynamic attribute hooks are never executed; members they generate remain outside the declared-source guarantee.

`EvidenceGoAdapter` parses selected `.go` files as directory-and-package populations. Exported defined types and aliases are `type` units; exported package functions, receiver methods, and interface methods are `function` units; exported constants, variables, and explicit struct fields, including embedded fields, are `property` units. Go's Unicode uppercase rule decides visibility. Receiver methods use `Type.Method` and can be addressed through either their declaration file or the selected file that declares their owner type.

Adjacent `//` runs and block comments are Go documentation hosts. A comment on a grouped declaration can host all declarations in the group, while a comment on one specification or member remains local to it. Detached comments, function-body comments, strings, raw strings, and commented-out declarations do not supply evidence. The adapter reads only selected source: it does not run the Go toolchain, evaluate build tags or filename platform constraints, promote embedded members, or fabricate generated declarations absent from the snapshot. Conflicting declarations across selected build variants and missing receiver owners make the inventory incomplete. Same-package `_test.go` files join their package, while external `_test` packages remain distinct.

`EvidenceRustAdapter` parses selected `.rs` files as static crate and module graphs. Public modules, structs, enums, traits, and type aliases are `type` units. Public free functions, inherent methods, and trait methods are `function` units. Public fields, tuple fields, constants, statics, enum variants, and associated constants are `property` units; trait associated types and their impl realizations are `type` units. Tuple fields use numeric segments such as `Pair[0]`.

Unrestricted `pub` establishes the external surface; restricted visibility does not. Conventional `mod name;` files, inline modules, named/grouped/wildcard `pub use` declarations, private-module reexports, and finite reexport chains preserve one originating identity across public aliases. Inherent members use `Type.member`. Trait implementation members use an explicit qualifier such as `Sale["impl crate::Service"].run`, so they cannot collide with inherent members.

Rust evidence attaches to outer or inner doc comments and static `#[doc = "..."]` attributes. The adapter does not run Cargo, rustc, build scripts, or macros. Missing or ambiguous module files, `#[path]`, unresolved public reexports, item-position macros, expansion attributes, `cfg` alternatives, blanket or external impl ownership, and syntax failures leave the inventory incomplete. Expression macros inside function bodies do not affect declaration completeness.

`EvidenceJavaAdapter` parses selected `.java` files as one source-public population with `tree-sitter-java` v0.23.5. Public classes, interfaces, enums, annotations, records, and publicly reachable nested types are `type` units. Public methods, including interface default and static methods, are `function` units. Public fields, interface constants, record components, enum constants, and annotation elements are `property` units. Constructors and compiler-generated record or enum methods do not form units.

Package names and nested owners establish semantic identity, while a file target begins with the top-level type, such as `Sale.java#Sale.calculate`. Methods with the same owner and name form one overload-family unit with every declaration site. A field and method may share a target spelling; the reference's `symbol` selection disambiguates them, while selecting both makes the target ambiguous. Imports and inherited members do not create units. The adapter applies Java source visibility independently of JPMS exports and does not execute annotation processors; generated source participates only when selected explicitly.

Only Javadoc immediately attached to a supported public declaration carries Java evidence, exclusions, reviews, or withdrawal. Attachment survives intervening declaration annotations and modifiers. Tags inside `{@code ...}`, `{@literal ...}`, `{@snippet ...}`, `<code>...</code>`, and `<pre>...</pre>` examples stay inert. Ordinary comments, strings, text blocks, and Javadoc on unpublished declarations do not create evidence edges. Conflicting selected identities and syntax failures leave the inventory incomplete.

`EvidenceKotlinAdapter` analyzes selected `.kt` files with `tree-sitter-kotlin` v1.1.0. Classes, interfaces, objects, companions, and type aliases are `type` units. Top-level and member functions are `function` units, grouped into overload families by package, lexical owner, receiver, and name. Explicit properties, primary-constructor `val`/`var` parameters, and enum entries are `property` units. A property's getter and setter belong to the property; a private setter does not hide its public getter. Constructors themselves and compiler-generated or inherited members do not add units.

Kotlin declarations are public by default. Private, internal, and protected declarations and their descendants do not participate. An override with no explicit visibility produces incomplete analysis because its visibility depends on the inherited member. Explicit public overrides participate. `expect`/`actual` declarations and public delegation also produce incomplete analysis. The snapshot does not execute a compiler, annotation processor, build system, or application. `.kts` scripts are rejected rather than interpreted as ordinary source files.

Package names contribute to Kotlin semantic identity; file accessors begin at the top-level declaration. Use `Contract.kt#Contract.value` for a property and `Contract.kt#Contract.Companion.run` for an unnamed companion member. Named companions retain their declared name, such as `Contract.Tools.run`. Extensions stay under their lexical owner and add a quoted receiver segment, such as `Contract.kt#["extension(kotlin.String)"].measure`. Selected nominal declarations, selected type-alias chains, explicit imports, and Kotlin core scalar types establish canonical receiver names; imports do not create exported declarations. Generic, function-type, type-parameter, cyclic, ambiguous, and unresolved wildcard-dependent receivers produce incomplete analysis. Type aliases are independent named type declarations, and dependency-derived member expansion is outside the declared-source surface. Backtick names are literal segments, so a property named `value.part` is addressed as `Contract["value.part"]`.

Adjacent `/** */` KDoc attaches before declaration annotations. Evidence tags in ordinary comments, strings, and unattached KDoc never acknowledge a target; recognized tags on unsupported carriers produce diagnostics. Fenced and indented examples remain inert. Withdrawals propagate through lexical ownership, and annotation-only edits preserve semantic fingerprints.

The pinned upstream Kotlin grammar requires a newline or semicolon before some closing class-body braces, including `class Example { val value = 1; }`. The equivalent spelling without that separator can produce an `ERROR` node and is reported as incomplete analysis. Evidence does not rewrite source or discard parser errors to obtain a smaller passing inventory.

`EvidenceCSharpAdapter` parses selected `.cs` files with `tree-sitter-c-sharp` v0.23.5. Public classes, structs, interfaces, records, enums, delegates, and reachable nested types are `type` units. Public methods and operators are `function` units. Public fields, properties, events, enum members, and indexers are `property` units. Constructors, explicit interface implementations, positional record properties, inherited members, and other compiler-generated members do not form units.

C# semantic identity and target addresses include block or file-scoped namespaces: `Sale.cs#Shop.Sale`, `#Shop.Sale.Total`, and `#Shop.Sale.Calculate`. Methods with the same owner and name form one overload family. Indexers use `Owner["this[]"]`; operators use literal segments such as `Owner["operator +"]` and `Owner["implicit operator int"]`. Static and instance members both use their declared owner because C# does not permit them to establish independent same-name member identities.

Generic type identity includes arity. ``Shop["Box`1"]`` selects `Box<T>` exactly. `Shop.Box` is a source-name alias: one generic arity can own it, multiple generic arities make it ambiguous, and a declared nongeneric `Box` takes precedence. The configured source snapshot is the partial-type compilation boundary. Compatible partial declarations share one unit and retain every site; the normalized configured root participates in the unit ID so separate project roots remain distinct. Conflicting forms, accessibilities, or non-partial duplicate types leave analysis incomplete.

Only externally reachable declarations enter the population. Top-level types require `public`; nested types require `public` except that a type declared in an interface is public by default. Every containing type must also be public. Interface members are public when they omit an accessibility modifier, including members with implementations. `internal`, `file`, `private`, `protected`, `protected internal`, and `private protected` declarations stay outside the population. Attached `///` and `/** */` XML documentation carries evidence across attributes. Tags inside `<c>`, `<code>`, `<example>`, and `<pre>` stay inert. Other comments and string forms are unsupported hosts. Declaration-position conditional compilation makes the inventory incomplete because the adapter does not evaluate build symbols. It does not run the .NET SDK, source generators, or application code; generated `.cs` participates only when selected directly.

`EvidenceCAdapter` parses selected `.c` and `.h` files with `tree-sitter-c` v0.24.2. Named structs, unions, enums, and typedefs are `type` units. Non-static functions are `function` units. Non-static external objects, aggregate fields, and enumerators are `property` units. A function prototype and definition share one unit inside a physical file, while declarations in a header and source file remain separate because the adapter does not preprocess includes or perform linker analysis.

C tags use exact addresses such as `models.h#["struct Sale"]`; an unambiguous source-name alias permits `models.h#Sale`. A direct typedef such as `typedef struct Sale Sale` adds `Sale` as a canonical address for the same type, and its fields are available through both spellings. If an ordinary declaration already owns `Sale`, the tag's convenient `Sale` alias and its member subtree are suppressed while the exact tag address remains available. Anonymous aggregates become type units when a direct typedef names them; unnamed struct or union members promote their explicit fields to the containing aggregate.

The adapter follows nested declarators to distinguish functions returning pointers from function-pointer objects, including arrays, qualifiers, attributes, and multi-declarator statements. Attached leading or trailing Doxygen carries graph tags, while ordinary comments, strings, body comments, and detached Doxygen are unsupported hosts. Doxygen code and preformatted regions stay inert. Conventional whole-file include guards and `#pragma once` are structural wrappers; other conditional preprocessing, declaration-position macro invocations, and declaration-affecting directives make the inventory incomplete. Includes are not traversed, macro definitions are not expanded, and generated headers participate only when selected explicitly.

`EvidenceCppAdapter` parses selected C++ source and header files with `tree-sitter-cpp` v0.23.4. Namespaces, classes, structs, unions, enums, aliases, typedefs, and concepts are `type` units. Free and member functions, constructors, destructors, operators, and conversions are `function` units. External variables, public fields, static data members, and enumerators are `property` units.

C++ identities retain namespaces, nested owners, and template arity. ``shop["Box`1"].value`` identifies a member of `Box<T>`. Constructors and destructors use `constructor` and `destructor`; operators use literal segments such as `["operator +"]` and `["operator bool"]`. Header declarations and qualified source definitions merge across the selected snapshot, while name-only overloads contribute every declaration and definition site to one unit. Bounded `using` declarations and namespace aliases add addresses when they resolve to exactly one selected public unit.

Only declarations reachable through public owners enter the population. Class members default to private, struct and union members default to public, and namespace-scope `static`, plain `const`, `constexpr`, and anonymous-namespace declarations stay outside the external surface. Attached leading or trailing Doxygen carries graph tags. The adapter does not run a preprocessor, compiler, build system, template instantiator, module resolver, or linker; conditional declarations, specializations, inheritance, friends, unresolved aliases, and other semantic boundaries leave the inventory incomplete.

`EvidenceRubyAdapter` parses selected `.rb`, `.rake`, and `.gemspec` files, plus `Gemfile` and `Rakefile`, with `tree-sitter-ruby` v0.23.1. Classes and modules are `type` units. Public instance and singleton methods and bounded aliases are `function` units. Public constants and literal `attr_reader`, `attr_writer`, and `attr_accessor` declarations are `property` units. A reader and writer for the same attribute share one property identity while retaining both declaration sites.

Ruby instance methods use `Shop.Sale.total`; singleton methods use `Shop.Sale.self.find`. Setters and operators preserve their Ruby spelling through quoted segments such as `Shop.Sale["price="]` and `Shop.Sale["[]"]`. Lexical `public`, `private`, and `protected` state and literal named visibility calls control publication. `module_function` publishes the singleton copy and removes its private instance copy from the public population. Compatible class and module reopenings retain all sites, while class/module mismatches, superclass conflicts, method or constant replacements, and ambiguous public addresses leave analysis incomplete.

Adjacent same-indent `#` runs and embedded `=begin`/`=end` RDoc attach to supported declarations. Tags in detached comments, method bodies, strings, heredocs, or documentation on unpublished declarations remain unsupported hosts. Top-level methods do not form Ruby export units. The adapter does not execute Ruby, resolve load order, expand inheritance or mixins, or evaluate `define_method`, `class_eval`, refinements, and generated class or module bodies; detectable changes across those boundaries leave the inventory incomplete.

Markdown preserves its document outline, and Prisma preserves its schema structure. Swagger claims select local JSON/YAML documents with `files` globs. Swagger references use `file` for an exact local JSON/YAML path or an HTTP(S) URL, with an optional `root` for local paths.

Markdown section anchors prefer a valid trailing `{#anchor}`. Otherwise, the adapter lowercases the heading, retains Unicode letters, numbers, and underscores, removes punctuation, and collapses whitespace or hyphens. Repeated anchors remain distinct sections and make the shared target ambiguous until the author supplies unique anchors.

## Evidence declarations

Write `@evidence <target> <reason>` in a declaration's documentation comment. Code targets name a file relative to the citing file, followed by `#` and a public symbol:

```ts
/** @evidence ../calculator.ts#add Verifies the addition contract. */
/** @evidence ../SomeClass.ts#SomeClass.member Supplies the public static member. */
/** @evidence ../SomeClass.ts#SomeClass Represents the class contract. */
/** @evidence ../SomeNamespace.ts#SomeNamespace.property Supplies the namespace value. */
```

TypeScript and Python instance members use `SomeClass.prototype.member`; Ruby instance members use `SomeClass.member`, and Ruby singleton members use `SomeClass.self.member`. Go receiver, Rust inherent, Java, C#, C++, and C aggregate members use `SomeType.member`. Rust trait impl members use a quoted `impl Trait` segment. C# and C++ targets include their namespace. C exact tag targets quote a segment such as `["struct Sale"]`. File-qualified targets identify declarations without compiler import-scoped `{@link Symbol}` lookup.

| Target                 | Example                               |
| ---------------------- | ------------------------------------- |
| Code symbol            | `../calculator.ts#add`                |
| Go receiver method     | `../sale.go#Sale.Calculate`           |
| Rust inherent method   | `../sale.rs#Sale.calculate`           |
| Rust trait impl method | `../sale.rs#Sale["impl Service"].run` |
| Java overload family   | `../Sale.java#Sale.calculate`         |
| Java record component  | `../Point.java#Point.x`               |
| C# namespaced property | `../Sale.cs#Shop.Sale.Total`          |
| C# generic type        | ``../Box.cs#Shop["Box`1"]``           |
| C# indexer family      | `../Sale.cs#Shop.Sale["this[]"]`      |
| C++ template member    | ``../box.hpp#shop["Box`1"].value``    |
| C++ operator family    | `../sale.hpp#shop.Sale["operator +"]` |
| C exact struct field   | `../sale.h#["struct Sale"].total`     |
| C typedef field        | `../sale.h#Sale.total`                |
| Python symbol          | `../calculator.py#add`                |
| Python instance member | `../sale.py#Sale.prototype.total`     |
| Ruby instance method   | `../sale.rb#Shop.Sale.total`          |
| Ruby singleton method  | `../sale.rb#Shop.Sale.self.find`      |
| Ruby setter method     | `../sale.rb#Shop.Sale["price="]`      |
| Markdown document      | `docs/requirements.md`                |
| Markdown heading       | `docs/requirements.md#pricing`        |
| Prisma model or field  | `prisma:Sale`, `prisma:Sale.price`    |
| Swagger operation      | `POST:/sales`                         |

Markdown paths resolve from the reference population's root. Backslashes are accepted as portable separators and leading `./` is ignored, while case and percent signs remain literal. The text after `#` is one exact Markdown anchor, so `docs/spec.md#price.v2` does not mean nested members. Markdown claims place tags in HTML comments. Prisma claims use `///` or block documentation attached to models and members; an unattached top-level `///` run may carry exclusions only.

Swagger claims read tags from each operation's `description`. For example, an operation can cite a Markdown requirement:

```yaml
paths:
  /sales:
    post:
      description: |
        Creates a sale.
        @evidence docs/requirements.md#sales Exposes the required sale creation operation.
```

Fenced examples and other JSON/YAML string fields do not host tags. Operations without descriptions remain selected hosts for coverage policies.

Swagger 2.0 and supported OpenAPI 3.x JSON/YAML documents are normalized into standard and additional operations under `paths`. Paths keep their exact case, spelling, and trailing slash; methods become uppercase. Components, path items, webhooks, and the whole document do not become aggregate units. Each operation fingerprint includes its normalized content and recursively referenced local components. Recursive references terminate, while unresolved or external schema references remain unfetched.

Swagger references load one exact local path or explicit HTTP(S) URL. Remote documents are fetched for every load with a 30-second timeout and a 16 MiB response limit; retained paths and diagnostics omit URL credentials and query values. Any file, fetch, UTF-8, parse, version, normalization, duplicate-operation, or target-shape failure leaves the inventory incomplete.

A citation to a containing type, namespace, document section, or model covers its selected descendants. `@evidenceExclude <target> <reason>` records why a selected obligation does not apply, subject to the reference's policy. The checker validates the declaration and its target; reviewers judge whether the explanation is true.

## Reviews

Set `requireReview: true` on a reference when every accepted acknowledgement must carry a current review. Pair `@evidence` with `@evidenceReview`, and pair `@evidenceExclude` with `@evidenceExcludeReview`, on the same semantic claim host and resolved target:

```ts
/**
 * @evidence docs/requirements.md#pricing Implements the pricing rule.
 * @evidenceReview docs/requirements.md#pricing #4c0e8e1 Read the rule and exercised its boundary cases.
 */
export function calculatePrice(): number {
  return 0;
}
```

The seven-character fingerprint represents the cited identity and its full structural subtree. It is independent of the reference selector and public alias used to reach that identity. Evidence annotations, checkout line endings, and trailing whitespace do not change it; semantic content, descendants, declaring identity, and withdrawal decisions do.

`EvidenceFingerprint.inspect(inventory, unitId)` returns the fingerprint version, the unit's content digest, the full scope digest, and the presented seven-character value. It refuses incomplete inventories. Source snapshot digests remain separate cache identities.

Fingerprint version changes are review migrations. Inspect the new value, review the cited scope again, and update the tag only after that review. The checker reports the expected current value but does not write approving prose or renew reviews automatically.

## Coverage policies

Set policies on each reference:

| Option | Obligation |
| --- | --- |
| `noEvidenceExclude` | Require positive evidence; exclusions do not provide coverage. |
| `uniqueEvidence` | Allow at most one distinct claim host to cite each selected unit. |
| `singleEvidencePerSymbol` | Require every selected claim host to cite exactly one selected unit. |
| `requireReview` | Require a matching review with the current target content fingerprint. |
| `checklist` | For Markdown references, require every selected claim host to answer every selected item. |

A checklist's positive citation answers only the named item. It cannot combine with `uniqueEvidence` or `singleEvidencePerSymbol`.

A claim's `evidenceExcludeCarriers` globs restrict where exclusions may be written within its selected files. They cannot combine with a checklist that accepts exclusions.

The root configuration accepts an optional `severity: "off" | "warning" | "error"`, defaulting to `"error"`. Claims and references may override it with their own optional `severity`: a claim inherits the root level, and a reference inherits its claim's level. A claim can also set `disabled: true`.

## Public types

The package exports `IEvidenceConfig`, `IEvidenceClaim`, `IEvidenceReference`, and their shared base interfaces. `IEvidenceClaimBase<Type, SymbolKind>` and `IEvidenceReferenceBase<Type, SymbolKind>` own their common settings and symbol selectors. Both specialize into programming, database, Markdown, and Swagger populations. `IEvidenceSwaggerClaim` selects operations and reads evidence declarations from their descriptions.

`EvidenceProgrammingType` and `EvidenceDatabaseType` define source-language identifiers. `EvidenceProgrammingSymbol`, `EvidenceDatabaseSymbol`, and `EvidenceMarkdownSymbol` define symbol selectors; `EvidenceSeverity` defines diagnostic levels. `IEvidenceDocumentedConfig` selects programming symbols that must carry documentation comments.

## Development

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start --include config_loader
pnpm check:format
```

The pnpm workspace contains the published library in `packages/evidence` and logic unit tests in `test`. `pnpm build` compiles through `ttsc` with strict `@ttsc/lint` rules, including `@ttsc/evidence`'s `evidence/singular` rule. Run affected local tests with `pnpm start --include <filter>`; repeat `--include` to select several groups. CI runs the complete suite through `pnpm test`. Both commands execute exported unit-test functions through `ttsx` and `@nestia/e2e`'s `DynamicExecutor`.

Dependency versions are centralized in the family catalogs in `pnpm-workspace.yaml`. Each package and the test workspace extend the shared configuration under `config`. VS Code uses Prettier on save through `.vscode/settings.json`.

The root README and LICENSE are authoritative. During package preparation, `scripts/copy-readme-and-license.js` copies them into `packages/evidence`. Workspace imports resolve to TypeScript source; `publishConfig` supplies the compiled entry points, declarations, and CLI.

Grammar download pins live in `scripts/parser-grammars.json` and compile into ordinary package code. After changing pins, run `node scripts/prepare-parser-catalog.js`; `node scripts/prepare-parser-catalog.js --check` verifies the generated catalog without downloading WASM and also runs during `prepack`. Commit the metadata and generated catalog together. Tests automatically obtain real pinned grammars into the ignored `test/.tmp/parser-fixtures` directory, reused by CI. Missing test fixtures require network access; acquisition tests use those verified bytes with a separate disposable cache. Keep temporary test trees and maintenance experiments under `test/.tmp`.

For a grammar without a suitable upstream WASM release, add a recipe to `scripts/parser-builds.json` with its full source commit, grammar subdirectory, license path, ABI, and a real declaration/query probe. The manifest pins the Tree-sitter CLI and WASI SDK versions and download digests. Run `node scripts/build-parser-wasm.js <recipe>` on Linux or Windows x64. It builds two independent checkouts, compares their WASM bytes, and verifies parsing and capture through the installed `web-tree-sitter`. Outputs under `test/.tmp/parser-builds` include the grammar record and source/scanner/toolchain provenance. These are maintainer operations; checking a consumer project never builds a parser.

The `parser-wasm` workflow validates recipes on pull requests. To publish a verified artifact, dispatch it on `master` with the recipe identifier and `publish: true`. Its release tag includes the complete WASM digest, and publication never replaces existing assets. The publication job verifies a cold download through `TreeSitterAssets` and then reads the same cache with network access disabled. Register the resulting grammar record in `scripts/parser-grammars.json` only alongside its implemented, certified adapter.

## License

MIT, copyright 2026 Jeongho Nam. See [LICENSE](https://github.com/wrtnlabs/evidence/blob/master/LICENSE).
