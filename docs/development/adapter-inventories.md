# Adapter inventories

Implement `IEvidenceAdapter.analyze(snapshot)` to translate source snapshots into serializable graph data. The adapter owns declaration classification, public visibility, structural ownership, export resolution, documentation attachment, and unsupported-construct detection. A successful syntax parse alone does not establish a complete Evidence inventory.

## Identities and locations

| Record | Meaning |
| --- | --- |
| `IEvidenceUnit` | One semantic identity, its selector, explicit parent, declaration sites, and retained withdrawal markers. |
| `IEvidencePublicAddress` | A file and literal accessor segments that expose a unit. Several addresses can expose the same identity. |
| `IEvidenceUnitSite` | One declaration position and the content ranges belonging to this unit. |
| `IEvidenceHost` | A position that can carry documentation, its attachment status, declaration site, and semantic owners. |
| `IEvidenceDeclaration` | A positive acknowledgement or an exclusion with a target and reason. |
| `IEvidenceReview` | A verification statement paired by acknowledgement kind, host, and target; it supplies no coverage. |

Assign globally unambiguous IDs from physical source identity and language-established declaration identity. Merge overloads, declaration fragments, or reopened containers only when the language establishes that they are one identity. Never merge unrelated declarations by display name. Keep public module addresses independent of the defining file and identity.

Store literal accessor segments separately. `A["B.C"]` contains two segments; it does not establish a parent named `A.B`. Set `parentId` explicitly, including container relationships that are not represented by a textual prefix.

Use half-open original source spans with zero-based UTF-16 offsets and one-based lines and UTF-16 columns. Preserve CRLF and Unicode in source snapshots. Every attached host names a site owned by each listed unit. Register eligible hosts even when they contain no annotations. An operation without a description or a declaration without a comment must not vanish from policies that inspect every selected host.

A multi-variable statement can give two units the same site and documentation host. Give each unit its own content ranges so changing one initializer does not necessarily change its sibling's fingerprint. Keep all declaration sites when several declarations form one semantic identity.

## Combining and selecting

Construct `EvidenceInventory` from adapter inventories, then use `select(ids)` independently for each configured population. The constructor owns a validated copy; neither source-input mutations nor edits to returned snapshots change the index. Duplicate aliases and declaration records do not duplicate obligations. Different physical spellings of the same filesystem identity receive a deterministic declaration path while public addresses remain distinct.

Host `origins` retain the original paths used for relative citations; omitting the field initially means `file`. Resolve relative targets in the applicable population and source context, rather than using a diagnostic path chosen during merging. Several origins must not let scan order silently choose different evidence targets.

`select(ids)` includes selected visible units and their actual structural ancestors. It does not expose unrelated declarations merely because they occur in the same file. Withdrawal on any merged declaration hides that identity, its descendants, and their eligible hosts. The withdrawal remains available to explain a citation to a hidden target.

`resolve({ file, segments }, ids)` requires an exact address in the selected scope and reports `resolved`, `ambiguous`, `hidden`, `missing`, or `incomplete`. It does not search global display names or perform filesystem target resolution. Resolve authored paths and artifact-specific target forms before calling it.

`snapshot()` returns ordinary data with `schemaVersion: 1`; `serialize()` writes schema-order JSON with deterministic collection order for consistent inputs. Conflicting identities, missing parents, cycles, unowned hosts, or incorrect source coordinates mark analysis incomplete. Preserve upstream source failures in the adapter result as well. A healthy empty inventory is complete; failed analysis must never become a passing empty population. Annotation diagnostics can coexist with complete discovery, so inspect diagnostics as well as the completeness flag.

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

A review fingerprint is exactly seven lowercase hexadecimal characters after `#`. Other `#`-prefixed tokens followed by prose remain part of the description. Missing targets, blank prose, unsupported compiler inline links, malformed targets, and unsupported or unattached hosts produce actionable diagnostics. Retain these findings and merge valid declarations, reviews, and withdrawals into their separate inventory records. Review pairing and content freshness belong to graph evaluation, after target resolution.

Accessor examples include `Class.prototype.member`, `Namespace["member.with.dots"]`, and `Tuple[0]`. Quoted bracket segments use JSON strings; paths containing whitespace use percent encoding. Compiler import-scoped `{@link Symbol}` targets require migration to explicit file-qualified targets.

## Markdown inventories

`EvidenceMarkdownAdapter` materializes one file unit and each ATX H1-H4 section. Setext headings and H5/H6 do not form units. A deeper or unaddressable heading still opens a source region: its content belongs to the nearest real ancestor, while annotations in that region are unsupported until another H1-H4 host opens.

Prefer a valid trailing `{#anchor}`; otherwise derive the anchor from the heading by retaining Unicode letters, numbers, and underscores, removing punctuation, and collapsing whitespace or hyphens. Keep duplicate anchors as distinct identities with the same public address so resolution reports ambiguity. Every selected logical file alias contributes an address, but an alias containing whitespace contributes a diagnostic because the authored target grammar cannot represent it as one token.

HTML comments are the only Markdown documentation hosts. Register a real comment even when it has no Evidence tag, attach it to the unit active on its opening line, and parse it with `tagBoundaries: false` and `allowWithdrawal: false`. Report a line-start tag rendered as ordinary prose, including list and quote forms. Ignore tag-shaped examples in fences, indented code, `<pre>` blocks, and MDX template code.

Partition a section's own content into original source ranges. Include heading lines, ordinary body text, deeper unsupported headings, and fenced examples. Exclude full HTML-comment lines; retain surrounding prose when a comment appears mid-line so later fingerprinting can remove only the registered comment span. Preserve the source snapshot's completeness and diagnostics before normalizing the inventory.
