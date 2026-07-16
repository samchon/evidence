// `@samchon/evidence` — a `@ttsc/lint` rule contributor.
//
// This descriptor mirrors the shape of an ESLint flat-config plugin object
// (meta + rules) with one field that carries runtime meaning: `source`. It
// points at this package's Go source directory (`../native`), which ttsc's
// plugin builder statically links into `@ttsc/lint`'s binary on first build.
//
// The `rules` array is advisory — the authoritative registration happens in the
// Go `init()` of `native/evidence.go` via `rule.Register(...)`. Declaring the
// names here only powers TypeScript autocomplete for `evidence/*` keys in a
// consumer's lint config, and a name listed here but never registered in Go
// fails silently at runtime rather than loudly at build.
import type { ITtscLintPlugin, TtscLintRuleSetting } from "@ttsc/lint";
import path from "node:path";

const plugin = {
  meta: {
    name: "@samchon/evidence",
    version: "0.1.0",
    namespace: "evidence",
  },
  rules: [
    // Project-scoped. Builds the document and symbol index every other rule
    // resolves against.
    "index",
    // Citation integrity: every `@evidence` tag must carry a reason and point
    // at something that exists.
    "reference",
  ] as const,
  // Absolute path so it stays valid regardless of where the consumer's
  // node_modules lives. `__dirname` is `<pkg>/lib`, so `../native` is the Go
  // source directory shipped alongside the compiled JS.
  source: path.resolve(__dirname, "..", "native"),
} satisfies ITtscLintPlugin;

declare module "@ttsc/lint" {
  interface ITtscLintRuleOptionsMap {
    /**
     * Builds the evidence index: the identity source every reference resolves
     * against.
     *
     * This rule is project-scoped, so it must be configured in a config entry
     * that has no `files` key; an entry with `files` is rejected even when
     * empty or `off`.
     *
     * Turning it off is not a way to relax enforcement — it silences every
     * other evidence rule, because without an index there is nothing to resolve
     * against and a rule that reported anyway would be blaming authors for its
     * own blindness.
     */
    "evidence/index": {
      /**
       * Project-relative globs of markdown to index. Defaults to
       * `["**\/*.md"]`.
       *
       * Supports `**`, `*`, and `?`. Matching is case-sensitive even on a
       * case-insensitive filesystem, because a path has one true spelling and
       * admitting another yields references the index cannot resolve.
       *
       * `node_modules`, `.git`, `lib`, `dist`, and `coverage` are never walked:
       * they hold other people's markdown, and a citation resolving against a
       * dependency's README proves nothing.
       */
      documents?: readonly string[];
    };
  }

  interface ITtscLintContributorRules {
    /**
     * Requires every `@evidence <target> <reason>` tag to carry a reason and to
     * resolve against the index.
     *
     * This is citation integrity, not coverage. Coverage asks which sections
     * nothing has proven, and so can only ever see a section with no citation;
     * it is structurally blind to a citation with no section. Renaming a
     * document or re-anchoring a heading strands every citation pointing at it,
     * and only this rule can say so.
     */
    "evidence/reference"?: TtscLintRuleSetting;
  }
}

export default plugin;
