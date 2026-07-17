---
name: lint-rule-authoring
description: Defines the @ttsc/lint contributor contract for @samchon/evidence — the hybrid TypeScript-descriptor plus Go-source package shape, the Go rule API, project-scoped rules, options typing, and the expensive defaults the API sets for you. Use before adding or modifying a Go rule, editing the plugin descriptor, changing the published file set, or wiring rule options; do not use for what the rules should mean, which the evidence-graph skill owns.
---

# Lint Rule Authoring

Authoritative upstream reference: `D:/github/samchon/ttsc/website/src/content/docs/development/walkthroughs/lint.mdx`. Read its "How a contributor package ships" and "Project-scoped contributor rules" sections before your first rule. Distilled notes with file:line citations live in `.wiki/references/ttsc.md`; correct that page when it disagrees with upstream.

## The Package Is A Hybrid

`@ttsc/lint` has no JavaScript rule runtime. A contributor package is a TypeScript descriptor whose only load-bearing field is `source`, an absolute path to a directory of Go sources. At build time ttsc copies that directory into its own Go module, synthesizes a blank import to fire your `init()`, and statically links the result into the lint binary.

- **Rule logic is Go. Always.** TypeScript owns the descriptor, the config types, and the e2e tests. Nothing else.
- **Ship no `go.mod`.** You ship a _package_, not a _module_, so the host's `go.mod` governs every transitive dependency and the supply-chain surface stays closed.
- **The Go package name is the namespace after transformation.** Hyphens become underscores for the Go identifier while the user-facing rule prefix keeps them.
- **`files` must publish the Go directory.** A tarball without it cannot build on a consumer's machine. This is the single easiest way to ship a package that passes CI and fails for every user.
- **`source` must resolve from the built output.** The descriptor compiles into `lib/`, so build the path with `path.resolve(__dirname, "..", "<dir>")`. ttsc rejects a `source` that is not a string, not absolute, or not an existing directory, each with its own error.
- **The descriptor's `main` points at compiled CJS, never at `src/index.ts`.** ttsc loads a descriptor through a `ttsx` subprocess that evaluates a `.ts` entry in ES module scope, where `__dirname` does not exist — and `__dirname` is exactly what `source` needs, because ttsc demands an absolute path. Source-first entry points are a good pattern in other samchon repositories and a broken one here; `.wiki/design/decisions.md` records the failure verbatim. Do not "restore" it.

## The Rule Interface

```go
type Rule interface {
	Name() string
	Visits() []shimast.Kind
	Check(ctx *rule.Context, node *shimast.Node)
}
```

Register in `init()`. Registration does not check duplicates, and a name that collides with an existing rule drops your rule with a stderr warning rather than failing loudly — so a typo costs you a silently absent rule.

Dispatch is a kind-keyed table, not a visitor. `Visits()` enrolls the rule into `map[shimast.Kind][]Rule` and the engine calls `Check` once per matching node. `KindSourceFile` rules dispatch **before** the statement walk against `file.AsNode()`; the walk closure only ever sees statements. Register multiple kinds and branch on `node.Kind` when you need both.

## `As*` Accessors Panic — Check `Kind` First

`node.AsModuleBlock()` and its siblings are **type assertions, not conversions**. Handed the wrong node they panic; they never return nil. A nil check after one is dead code that reads like a safeguard.

```go
// WRONG — panics on `namespace Outer.Inner {}`, whose Body is another
// ModuleDeclaration rather than a ModuleBlock.
body := module.Body.AsModuleBlock()
if body == nil { return }

// RIGHT — the Kind check is what makes the accessor safe.
switch module.Body.Kind {
case shimast.KindModuleBlock:
    body := module.Body.AsModuleBlock()
    ...
}
```

**Why this matters more here than in a normal rule.** The host turns a panic in `Check` into an error finding and keeps going, so it looks survivable. It is not: this plugin's file rules all gate on an index published by a project rule, so a panic in the index rule means no index, which means every file rule goes silent. One malformed input anywhere disables evidence checking everywhere, and silence is this project's worst failure mode because it is indistinguishable from passing.

Never assume an AST shape from its source syntax. `namespace Outer.Inner {}` looks like one declaration with a dotted name and is actually nested declarations.

## The Defaults Are The Expensive Ones

Every optional marker interface defaults to the costly or broadest behavior when unimplemented. Implement them deliberately.

| Interface | Method | Unimplemented default | Implement it when |
| --- | --- | --- | --- |
| `TypeAwareRule` | `NeedsTypeChecker() bool` | **true** — builds a checker over every file and forces a **serial** walk | Return `false` for any AST-only rule. Then never read `ctx.Checker`; it may be nil. |
| `DeclarationFileRule` | `VisitsDeclarationFiles() bool` | **true** — dispatches on every `.d.ts` | Return `false` unless the rule genuinely inspects declaration files. |
| `OptionsRule` | `AcceptsTtscLintOptions() bool` | true | Leave alone unless refusing options. |
| `FormatRule` | `IsFormat() bool` | lint-class | This plugin ships no format rules. |

## Reporting

```go
func (c *Context) Report(node *shimast.Node, message string)
func (c *Context) ReportRange(pos, end int, message string)
func (c *Context) ReportFix(node *shimast.Node, message string, edits ...TextEdit)
func (c *Context) ReportRangeFix(pos, end int, message string, edits ...TextEdit)
```

- **Prefer `Report`.** It skips leading trivia for free. `ReportRange*` does not, and a node's `Pos()` can point inside surrounding whitespace — so a range you compute yourself will underline the wrong span unless you skip trivia yourself.
- **Emit one contiguous `TextEdit` per finding.** Overlapping edits within a pass are resolved by applying the earliest-starting and shortest, then **silently dropping the rest with no diagnostic**.
- **Design so the diagnostic alone is useful.** `ReportFix` falls back to a fix-less report when the host reporter does not support fixes, and it does so silently.
- `TextEdit` positions are byte offsets in the same space as AST nodes. Empty `Text` deletes.

## Project-Scoped Rules

A second registry, `rule.RegisterProject`, runs once per Program **before any file rule**. This plugin depends on it: markdown cannot enter the Program at all, so the document index is built here by reading files from disk directly, published with `ctx.SetState`, and read back by file rules through `ctx.ProjectResult(name)`.

- **The index must be immutable once built.** The host synchronizes only the state wrapper; the contents are yours to make safe, and file rules read it from a parallel walk.
- **Project findings have no file, no range, and no fix.** A markdown-side error cannot point at a line. Report TypeScript-side violations on the JSDoc node instead, where a position exists.
- **Project rules cannot be configured in an entry with `files`.** Such an entry is rejected even when empty or `off`.
- **`SetState` values live for one Program cycle.** Do not cache across cycles.
- **A declared, non-off project rule forces a serial walk for the entire run.** `engine.go:532-534` sets `eng.needsTypeChecker = true` for any project rule that is declared and not `off`, and `runsSerial()` (`engine.go:498-500`) reads that one flag for the whole engine. `NeedsTypeChecker` is **global, not per-rule**. Because `evidence/index` is always on in a working configuration, this plugin's file rules run serially no matter what they declare — so `evidence/reference`'s `NeedsTypeChecker() false` currently buys nothing. Keep declaring it anyway: it is true, it costs nothing, and it is correct the day upstream stops conflating the two. This is a genuine upstream gap — a project rule has no way to say it does not need the checker — and the best candidate for a contribution back to `ttsc`.

## Options

Declare Go options as a struct and decode with `ctx.DecodeOptions(&opts)`, which returns nil and touches nothing when unconfigured — so a zero value means "not set".

The Go `json:` tags and the TypeScript interface field names must match exactly; nothing checks this for you, and a mismatch silently yields defaults.

- **Option-bearing rule** — augment `ITtscLintRuleOptionsMap` for exact type checking.
- **Optionless rule** — augment `ITtscLintContributorRules` with `TtscLintRuleSetting`, which rejects a stray second tuple slot.
- **Neither** — the config falls back to an open index signature and the user gets no checking at all.

## Failure Policy

Know what the host absorbs and what it cannot.

- Panic in a metadata method drops the rule with a stderr warning.
- Panic in `Check` becomes a `SeverityError` finding tagged with the rule name; the engine continues.
- **Not recoverable:** panic in `init()`, panic in a goroutine you started, `os.Exit`, or a rule that never returns. Do not start goroutines, and do not let a rule loop unbounded on malformed input.

## What You Get Free

Do not reimplement these.

- `// ttsc-lint-disable-next-line <rule>` and its siblings, handled by the host.
- Unified diagnostics: lint findings render alongside type errors and the exit code sums both, which is what makes an evidence violation a real compile error.
- Severity resolution per file at dispatch time, so `files:` scoping already works.
