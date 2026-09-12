# Tags and targets

Evidence tags belong in documentation attached to a supported claim declaration. Adapters decide which comments are documentation, which declaration owns them, and whether that declaration is public. The tag parser does not scan arbitrary source text for convenient marker strings.

## Acknowledgements

```text
@evidence <target> <reason>
@evidenceExclude <target> <reason>
```

`@evidence` records that the host supplies the target. `@evidenceExclude` records that the target does not apply. Both require one whitespace-free target token and a nonempty reason. A reason may continue on following documentation lines until another recognized tag or documentation boundary.

```ts
/** @evidence docs/requirements.md#pricing Implements the documented price calculation. */
export function calculatePrice(): number {
  return 0;
}
```

`@link <file-qualified-target> <reason>` is accepted as a positive compatibility spelling. It does not restore compiler inline-link lookup. `@evidence {@link Symbol} ...`, `{@linkplain Symbol}`, and `{@linkcode Symbol}` are rejected with `unsupported-inline-link`.

## Reviews

```text
@evidenceReview <target> [#fingerprint] <description>
@evidenceExcludeReview <target> [#fingerprint] <description>
```

A review describes what was checked. `@evidenceReview` pairs only with `@evidence`; `@evidenceExcludeReview` pairs only with `@evidenceExclude`. The acknowledgement, review, and resolved target must share one semantic host.

When a reference sets `requireReview: true`, the fingerprint is required and must match the current cited scope. It is seven lowercase hexadecimal characters:

```ts
/**
 * @evidence docs/requirements.md#pricing Implements the price rule.
 * @evidenceReview docs/requirements.md#pricing #4c0e8e1 Checked rounding and error boundaries.
 */
export function calculatePrice(): number {
  return 0;
}
```

The graph diagnostic and `evidence inspect <target>` report the current fingerprint. Record it only after reviewing the target. A review without a description is invalid. A malformed fingerprint-like token with no description is also invalid.

## Withdrawals

`@internal`, `@hidden`, and `@ignore` in eligible programming or Prisma documentation withdraw the attached unit from public Evidence. Withdrawing a structural owner also hides its descendants. A target that reaches only a withdrawn address reports a hidden result; it is not treated as missing or silently removed from analysis.

These markers describe the public Evidence surface. They do not change source-language compiler visibility, package exports, or runtime behavior.

## Programming addresses

A programming target has a path and segmented accessor:

```text
<path>#<accessor>
```

The path resolves from the file carrying the tag. It must identify a file selected by that reference's `files` and `root`. The accessor resolves only inside the selected public declared-source scope.

| Declaration | Target from a neighboring file |
| --- | --- |
| Function `add` | `../calculator.ts#add` |
| Class `SomeClass` | `../SomeClass.ts#SomeClass` |
| Static member `SomeClass.member` | `../SomeClass.ts#SomeClass.member` |
| TypeScript instance member | `../SomeClass.ts#SomeClass.prototype.member` |
| Namespace property | `../SomeNamespace.ts#SomeNamespace.property` |
| Go receiver method | `../sale.go#Sale.Calculate` |
| Rust inherent method | `../sale.rs#Sale.calculate` |
| Rust trait implementation method | `../sale.rs#Sale["impl Service"].run` |
| Java or C# namespaced member | `../Sale.cs#Shop.Sale.Total` |
| Ruby instance method | `../sale.rb#Shop.Sale.total` |
| Ruby singleton method | `../sale.rb#Shop.Sale.self.find` |

Static and instance address rules follow each language. TypeScript, JavaScript, and Python use an explicit `prototype` segment for instance members. Java, C#, Go receiver methods, Rust inherent methods, C++ members, and C aggregate fields use the declared owner directly. Ruby uses the owner directly for instance methods and `self` for singleton methods.

Namespaces, packages, modules, and nested types contribute accessor segments when the certified language contract uses them for ownership. Public aliases create more addresses for one semantic identity; they do not create another obligation. A citation to a barrel alias resolves to the underlying unit, and renaming or removing that alias invalidates citations that name the old file address.

## Literal accessor segments

Ordinary identifiers use dot notation. A segment containing punctuation, whitespace, an operator spelling, template arity, or another non-identifier character uses JSON-string bracket notation:

```text
../source.ts#Namespace["member.with.dots"]
../Box.cs#Shop["Box`1"]
../sale.hpp#shop.Sale["operator +"]
../sale.h#["struct Sale"].total
../sale.rb#Shop.Sale["price="]
```

Numeric segments use brackets, such as `Tuple[0]`. Percent encoding protects path characters that cannot appear literally in the one-token target. The accessor parser preserves quoted segments and rejects empty or malformed boundaries rather than splitting them heuristically.

Use `evidence list` to copy a published address. Use `evidence inspect '<target>'` to confirm which configured claim and reference scopes resolve it.

## Markdown addresses

Markdown targets name a selected file and optionally one exact heading anchor:

```text
docs/requirements.md
docs/requirements.md#pricing
```

Markdown paths resolve from the reference population's `root`, which defaults to the configuration directory. Leading `./` is ignored, both separators are accepted, and case and percent signs remain literal. Text after `#` is one anchor, so `#price.v2` names that exact anchor and does not mean nested accessor segments.

A valid trailing `{#explicit-anchor}` controls the heading address. Without it, Evidence lowercases the heading, preserves Unicode letters, numbers, and underscores, removes punctuation, and collapses whitespace or hyphens. Repeated anchors remain separate units and make the shared address ambiguous until the document supplies unique anchors.

Markdown claims place tags in HTML comments. File-host comments appear before the first ATX heading; section-host comments belong to the nearest preceding ATX heading. Rendered prose, fenced or indented code, inline code, HTML `pre`, and MDX template examples do not host tags.

## Prisma addresses

Prisma addresses contain no path:

```text
prisma:Sale
prisma:Sale.price
prisma:Sale.seller
```

The configured reference population determines which selected schema files form the schema. `model` units own `column` and `relation` units. A model citation can cover selected descendants; a member citation names one parsed field exactly.

Prisma claims place tags in triple-slash or supported block documentation attached to a model or field. An unattached top-level triple-slash run can host an exclusion only. Ordinary `//` comments and comments attached to unsupported schema declarations do not supply evidence.

## Swagger and OpenAPI addresses

Swagger addresses contain an uppercase method, a colon, and the exact path:

```text
POST:/sales
GET:/sales/{saleId}
```

The complete address is one whitespace-free token. Method case is canonical. Path case, parameter spelling, and a trailing slash remain exact. Components, path items, webhooks, and the entire document do not become aggregate units.

Swagger claims read tags from each operation's `description`. Fenced examples and descriptions on responses, schemas, or other objects do not host tags. A Swagger reference loads one exact local JSON/YAML file or explicit HTTP(S) URL; a Swagger claim selects local files with globs.

## Target outcomes

| Outcome | Meaning |
| --- | --- |
| `resolved` | Exactly one public semantic identity owns the address in this scope. |
| `missing-file` | The addressed programming or Markdown file is outside the selected reference snapshot. |
| `missing-member` | The file or artifact exists, but the selected scope publishes no matching accessor. |
| `out-of-population` | The address exists in the inventory but is outside this reference's selected unit scope. |
| `unsupported-host` | The target form cannot be resolved from this declaration's artifact host. |
| `ambiguous` | Several selected identities own the same public address. |
| `hidden` | A matching declaration was withdrawn from the Evidence surface. |
| `malformed` | The target does not follow the artifact's target grammar. |
| `incomplete` | Source or adapter analysis cannot safely decide the result. |

The resolver never falls back to a project-wide symbol name. Correct the address, select the required source, or repair incomplete analysis. Do not rewrite a target to an unrelated declaration solely to clear the finding.

See [certified languages](languages.md) for each programming language's host and ownership rules, and [configuration](configuration.md) for reference roots and selectors.
