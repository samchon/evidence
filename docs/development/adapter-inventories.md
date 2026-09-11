# Adapter inventories

Implement `IEvidenceAdapter.analyze(snapshot)` to translate source snapshots into serializable graph data. The adapter owns declaration classification, public visibility, structural ownership, export resolution, documentation attachment, and unsupported-construct detection. A successful syntax parse alone does not establish a complete Evidence inventory.

## Identities and locations

| Record | Meaning |
| --- | --- |
| `IEvidenceUnit` | One semantic identity, its selector, explicit parent, declaration sites, and retained withdrawal markers. |
| `IEvidenceUnit.contentDigest` | An optional adapter-supplied digest of that unit's own normalized semantic content. |
| `IEvidencePublicAddress` | A file and literal accessor segments that expose a unit. Several addresses can expose the same identity. |
| `IEvidenceUnitSite` | One declaration position and the content ranges belonging to this unit. |
| `IEvidenceHost` | A position that can carry documentation, its attachment status, declaration site, and semantic owners. |
| `IEvidenceDeclaration` | A positive acknowledgement or an exclusion with a target and reason. |
| `IEvidenceReview` | A verification statement paired by acknowledgement kind, host, and target; it supplies no coverage. |
| `IEvidenceInventory.annotationRanges` | Every parser-recognized annotation span that fingerprinting must remove from semantic content. |

Assign globally unambiguous IDs from physical source identity and language-established declaration identity. Merge overloads, declaration fragments, or reopened containers only when the language establishes that they are one identity. Never merge unrelated declarations by display name. Keep public module addresses independent of the defining file and identity.

Store literal accessor segments separately. `A["B.C"]` contains two segments; it does not establish a parent named `A.B`. Set `parentId` explicitly, including container relationships that are not represented by a textual prefix.

Use half-open original source spans with zero-based UTF-16 offsets and one-based lines and UTF-16 columns. Preserve CRLF and Unicode in source snapshots. An attached semantic host names a site owned by each listed unit. An artifact may also define an attached exclusion-only carrier with no site or semantic unit; positive evidence on that carrier must be rejected. Register eligible hosts even when they contain no annotations. An operation without a description or a declaration without a comment must not vanish from policies that inspect every selected host.

A multi-variable statement can give two units the same site and documentation host. Give each unit its own content ranges so changing one initializer does not necessarily change its sibling's fingerprint. Keep all declaration sites when several declarations form one semantic identity.

Fingerprint input comes from an adapter-supplied `contentDigest` or the source slices in each site's `content` ranges. Keep a source snapshot digest as a cache key only; it cannot substitute for a unit digest. Register every recognized annotation range, including comments on hidden or unsupported declarations, so editing a review cannot invalidate the scope it reviews.

## Combining and selecting

Construct `EvidenceInventory` from adapter inventories, then use `select(ids)` independently for each configured population. The constructor owns a validated copy; neither source-input mutations nor edits to returned snapshots change the index. Duplicate aliases and declaration records do not duplicate obligations. Different physical spellings of the same filesystem identity receive a deterministic declaration path while public addresses remain distinct.

Host `origins` retain the original paths used for relative citations; omitting the field initially means `file`. Resolve relative targets in the applicable population and source context, rather than using a diagnostic path chosen during merging. Several origins must not let scan order silently choose different evidence targets.

`select(ids)` includes selected visible units and their actual structural ancestors. It does not expose unrelated declarations merely because they occur in the same file. Withdrawal on any merged declaration hides that identity, its descendants, and their eligible hosts. The withdrawal remains available to explain a citation to a hidden target.

`resolve({ file, segments }, ids)` requires an exact address in the selected scope and reports `resolved`, `ambiguous`, `hidden`, `missing`, or `incomplete`. It does not search global display names or perform filesystem target resolution. Resolve authored paths and artifact-specific target forms before calling it.

`snapshot()` returns ordinary data with `schemaVersion: 1`; `serialize()` writes schema-order JSON with deterministic collection order for consistent inputs. Conflicting identities, missing parents, cycles, unowned hosts, or incorrect source coordinates mark analysis incomplete. Preserve upstream source failures in the adapter result as well. A healthy empty inventory is complete; failed analysis must never become a passing empty population. Annotation diagnostics can coexist with complete discovery, so inspect diagnostics as well as the completeness flag.

## File-qualified targets

`EvidenceFileTarget.parse(target, origin)` handles file-qualified programming targets. It decodes the path, resolves it from the citing file, and retains each accessor segment. Omitting `#` addresses the artifact's file unit; a trailing `#` is invalid. `format(address)` produces canonical text by percent-encoding reserved path characters and using dotted identifiers or JSON-string brackets for members. Equivalent encoded paths therefore reach the same absolute address, while `A.B` and `A["B.C"]` remain different.

Markdown keeps its original target grammar. Its file path is relative to the reference population root, `\` becomes `/`, and repeated leading `./` is ignored. Case, percent signs, and other path text remain literal. The text after `#` is one literal anchor segment, including dots, colons, and hyphens. Do not percent-decode Markdown paths or parse their anchors as programming accessors.

Prisma targets contain no file path. Parse `prisma:Model` and `prisma:Model.member` into the virtual `prisma:` address plus one or two identifier segments. Model identity belongs to the whole selected schema, so moving its declaration between selected files cannot change its target.

`EvidenceTargetResolver` accepts reference inventories, a target-bearing acknowledgement or review, its claim host, and the reference's selected unit IDs. For Markdown it matches root-relative logical source addresses. For other file-qualified artifacts it tries every retained claim-host origin. It queries only exact public addresses in the selected structural scope, unifies aliases by semantic unit ID, and never searches another file for a matching display name.

Resolution distinguishes malformed targets, missing files, existing files outside the reference, missing or unselected public members, withdrawn identities, ambiguous addresses, unsupported hosts, and incomplete inventories. An incomplete export graph prevents an otherwise valid address from resolving. An adapter may load an address only for dependency analysis by setting `IEvidenceSourceAddress.selected` to `false`; such a file can supply a selected barrel export but cannot be cited directly. TypeScript reexports must remain inside both the logical and resolved physical population roots.

## Graph evaluation

`EvidenceGraph.evaluate(input)` consumes fully materialized inventories and target resolutions without reading files. Each configured claim and each element of its reference array remains a separate indexed obligation; an optional claim name only labels its diagnostics. A disabled claim or a healthy claim with no selected semantic host is inactive; an incomplete claim remains active because failed discovery cannot prove that its population is empty.

Supply only the claim declarations whose target grammar applies to a reference in that reference's `resolutions`. The evaluator first accepts an exact resolved target in the reference's structural scope, then checks its claim host. Positive evidence must belong to a selected semantic claim host. An exclusion may use any attached claim host unless `exclusionHostIds` narrows the carrier set, and `noEvidenceExclude` refuses every exclusion. Reviews never enter the coverage ledger.

An accepted acknowledgement covers the selected target and selected descendants reached through explicit `parentId` links. The resulting edge retains the declaration, its documentation position, its semantic host identities, the exact target, and every selected unit covered by the scope. Repeating positive evidence on the same semantic host and exact target is a duplicate. Overlapping exclusions and opposite positive/exclusion intent each produce one finding for the later declaration, regardless of the number of descendants in the overlap. Positive evidence from different semantic hosts remains valid.

Cardinality policies count semantic identities rather than documentation positions. `uniqueEvidence` permits at most one distinct positive claim host for each selected reference unit. `singleEvidencePerSymbol` requires each selected claim host, including hosts with no tags, to cite exactly one distinct selected reference unit. Aggregate targets count every selected descendant, while exclusions contribute no positive host or unit count.

Supply applicable review target results in `reviewResolutions`. Review pairing uses acknowledgement kind, exact resolved target identity, and overlapping semantic host identity. This lets merged declaration positions review the same host while keeping unrelated declarations separate. A review at an unattached position falls back to its exact physical host. Duplicate reviews at one documentation position, orphan reviews, and reviews of the opposite acknowledgement kind receive distinct diagnostics. A real acknowledgement refused by another policy still prevents its review from being mislabeled as orphan; neither record enters coverage.

`requireReview` adds freshness checks to accepted acknowledgement edges. Each edge exposes the same seven-character value returned by `EvidenceFingerprint.inspect`. A missing review, a review without a fingerprint, and a stale fingerprint are mutually exclusive findings, and each repair names the current value. Review resolution that is incomplete makes the obligation incomplete and suppresses those derivative findings. Explicit resolved reviews are still audited for structural pairing when freshness is not required.

Fingerprint version 1 hashes the exact declaring identity, symbol kind, normalized own content, retained withdrawal kinds, and every explicit descendant linked by `parentId`. It removes registered annotations, normalizes CRLF and CR to LF, trims trailing horizontal whitespace, and ignores trailing blank lines. It does not depend on the selected public alias or reference projection. Changing the digest algorithm requires a fingerprint-version increment; consumers then inspect the new value and re-review affected scopes rather than mechanically accepting the migration.

A Markdown `checklist` creates one obligation for every selected claim host and selected Markdown item. Positive evidence answers only the selected item it names. Exclusions retain descendant coverage for their own host. An unselected positive aggregate produces one direct diagnostic and records its selected descendants as explained, so the same host does not receive derivative missing-item diagnostics for that mistake. The obligation's `hostCoverage` retains each host's covered, missing, and explained units; its top-level covered units are those answered by every host. Configuration validation rejects checklists on other artifact kinds, incompatible cardinality options, and gathered exclusion carriers unless exclusions are disabled for that reference.

Incomplete claim, reference, or target analysis leaves its active obligation incomplete and suppresses derivative empty-population and missing-coverage findings. It also withholds a deferred unhosted-checklist finding when the failed obligation could have consumed that declaration. A healthy empty reference emits one population finding and does not create that uncertainty. `success` requires every active obligation to be complete and the deterministic diagnostic list to be empty.

## Documentation and tags

Identify real documentation through the artifact parser and establish its semantic host before reading tags. Pass known comment delimiters to `EvidenceDocumentation.read(content, hostId, range, syntax)`. JSDoc-style comments use their own delimiter and line prefix; Prisma documentation can use `///`; Markdown HTML comments have no foreign-tag field boundaries. The helper preserves a source map through prefix removal and CRLF normalization.

For decoded text such as Swagger operation descriptions, an adapter may supply `IEvidenceDocumentation` directly. Provide each UTF-16 code unit's original start in `offsets` and exclusive end in `ends`, followed by the final source boundary in `offsets`. Maps must remain ordered and within the host. These separate boundaries preserve gaps caused by decoration or encoded text.

`EvidenceTagParser.parse(content, host, documentation)` recognizes:

```text
@evidence <target> <reason>
@link <file>#<Accessor> <reason>
@evidenceExclude <target> <reason>
@evidenceReview <target> [#<fingerprint>] <description>
@evidenceExcludeReview <target> [#<fingerprint>] <description>
```

Markers begin a documentation line and end at a space, tab, or line boundary. Reasons and review descriptions can continue across lines. Fenced examples produce no tags. `tagBoundaries` controls whether another tool's line-start tag ends an acknowledgement; reviews always end at another tag. `allowWithdrawal` enables line-start `@internal`, `@hidden`, and `@ignore` in documentation positions where withdrawal is meaningful. Prose mentions do not withdraw declarations.

A review fingerprint is exactly seven lowercase hexadecimal characters after `#`. Other `#`-prefixed tokens followed by prose remain part of the description. Missing targets, blank prose, unsupported compiler inline links, and unsupported or unattached hosts produce actionable diagnostics. Ordinary evidence targets retain their authored token until the selected reference's resolver can apply its artifact grammar; explicit `@link` targets use the programming file-link grammar immediately. Retain valid declarations, reviews, and withdrawals in their separate inventory records. Review pairing and content freshness belong to graph evaluation, after target resolution.

Accessor examples include `Class.prototype.member`, `Namespace["member.with.dots"]`, and `Tuple[0]`. Quoted bracket segments use JSON strings; paths containing whitespace use percent encoding. Compiler import-scoped `{@link Symbol}` targets require migration to explicit file-qualified targets.

## Markdown inventories

`EvidenceMarkdownAdapter` materializes one file unit and each ATX H1-H4 section. Setext headings and H5/H6 do not form units. A deeper or unaddressable heading still opens a source region: its content belongs to the nearest real ancestor, while annotations in that region are unsupported until another H1-H4 host opens.

Prefer a valid trailing `{#anchor}`; otherwise derive the anchor from the heading by retaining Unicode letters, numbers, and underscores, removing punctuation, and collapsing whitespace or hyphens. Keep duplicate anchors as distinct identities with the same public address so resolution reports ambiguity. Every selected logical file alias contributes an address, but an alias containing whitespace contributes a diagnostic because the authored target grammar cannot represent it as one token.

HTML comments are the only Markdown documentation hosts. Register a real comment even when it has no Evidence tag, attach it to the unit active on its opening line, and parse it with `tagBoundaries: false` and `allowWithdrawal: false`. Report a line-start tag rendered as ordinary prose, including list and quote forms. Ignore tag-shaped examples in fences, indented code, `<pre>` blocks, and MDX template code.

Partition a section's own content into original source ranges. Include heading lines, ordinary body text, deeper unsupported headings, and fenced examples. Exclude full HTML-comment lines; retain surrounding prose when a comment appears mid-line so later fingerprinting can remove only the registered comment span. Preserve the source snapshot's completeness and diagnostics before normalizing the inventory.

## TypeScript inventories

`EvidenceTypeScriptAdapter` parses `.ts`, `.mts`, `.cts`, and `.tsx` snapshots with the packaged TypeScript or TSX grammar. It materializes exported interfaces, type aliases, classes, and namespaces as `type` units; object-shaped aliases also expose their members. Function and generator declarations are `function` units. A variable is a function only when a `const` identifier is initialized directly with a function value; mutable variables, typed declarations without such an initializer, and destructured leaves are properties.

Public class methods and directly written function fields are functions. Other public fields are properties. Static members use `Class.member`; instance members and parameter properties use `Class.prototype.member`. Interface members and object-type members use their containing type directly, except when an interface merges with a class and therefore joins the class instance side. Constructors, get/set and auto-accessors, private/protected members, computed names, index signatures, static blocks, and enums do not form units.

Local declaration identity remains separate from each exported address. The adapter follows direct exports, local aliases, defaults, imported bindings that are re-exported, named and star reexports, and namespace exports through relative source-snapshot paths. It recognizes `.js` to `.ts`/`.tsx`, `.mjs` to `.mts`, `.cjs` to `.cts`, and declaration-file substitutions. Explicit exports shadow star candidates; competing star candidates remain distinct so resolution can report ambiguity. Traversal terminates finite cycles, and a named export cycle that never reaches a declaration marks the inventory incomplete.

Named type-only exports and reexports retain only units available in type space, and that restriction travels through later value barrels. The pinned upstream grammar does not parse the TypeScript 5.0 `export type *` or `export type * as` spellings; encountering either produces a parse-incomplete diagnostic instead of a reduced population. Package exports, path aliases, ambient modules, global augmentations, UMD namespace exports, and CommonJS `export =` also remain explicit incomplete-analysis boundaries.

Only attached JSDoc is an eligible TypeScript documentation host. A variable statement can host all of its declarators, while a JSDoc block on an individual declarator belongs only to that declarator. Overloads and merged declarations share semantic identity and retain every declaration site. Withdrawal on any declaration hides the merged identity and its descendants. Tag-bearing line comments, ordinary block comments, detached JSDoc, local declarations, and excluded declaration forms produce unsupported-host findings instead of evidence edges.

## JavaScript inventories

Share the ECMAScript declaration, JSDoc, and ESM export model with TypeScript, but select the JavaScript grammar and emit `javascript` identities. Recognize `.mjs` as ESM and `.cjs` as CommonJS. Resolve `.js` and `.jsx` from the nearest `package.json` along the logical file path, defaulting to CommonJS when none exists. Record checked package paths as exact dependencies. Conflicting aliases or invalid metadata make the inventory incomplete.

Use the same `type`, `function`, and `property` classification for JavaScript classes, callable declarations, and values. Preserve static and prototype ownership, literal names, anonymous defaults, async and generator forms, and JSX bodies. Constructors, accessors, private fields, and computed members remain outside the unit set.

Run the shared static ESM resolver over direct exports, local and imported aliases, defaults, named and star reexports, namespace exports, shadowing, ambiguity, and cycles. JavaScript resolution accepts only JavaScript extensions and relative or absolute files already present in the snapshot.

For CommonJS, process unconditional top-level initialization in source order. Support direct static properties with local declaration values, static object replacement, and one local default replacement. Clear prior names and detach `exports` when `module.exports` is replaced; reconnect it only through `exports = module.exports`. Mark computed keys, control-flow changes, dynamic or inline replacement values, binding shadowing, and escaped aliases incomplete. Do not inspect deferred function or class bodies as module initialization.

Attach only JSDoc that immediately precedes a supported declaration. Retain unsupported tag-bearing comments as findings, and exclude all registered annotation ranges from semantic fingerprints. Literal and JSX tag examples never become comment hosts.

## Prisma inventories

`EvidencePrismaAdapter` parses all selected physical files as one schema with `@prisma/prisma-schema-wasm`. Prefer a parser resolvable from the project root, then use the package's pinned fallback. Deduplicate physical sources before parsing and retain every logical address on the resulting source snapshot. A rejected schema makes the inventory incomplete and produces no guessed units.

Use the parser's `models` collection as the denominator. Materialize models and views as `model`, non-object fields as `column`, and object fields as `relation`; this includes relation back-references without a local `@relation` attribute. Enums, composite types, indexes, generators, and datasources remain outside the unit set. The position scanner may attach source sites to parser-established identities, but a missed position must retain the unit with a file-level fallback.

Assign each unit the canonical digest of its parsed declaration without documentation. Exclude fields from a model's own digest because each field is a child unit; the model scope fingerprint composes those children. The whole ordered schema set has a separate content digest for parser-result caching.

Attach `///`, plain block, and JSDoc-style block documentation to the next Prisma declaration. A top-level blank line detaches a run; a blank line inside a model does not. Ordinary `//`, comments above block attributes or closing braces, extra leading slashes, and comments on unsupported declaration kinds produce diagnostics. An unattached top-level `///` run is an exclusion-only carrier, including in explicitly selected files with nonstandard extensions. Withdrawal on a model hides its descendants.
