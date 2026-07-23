import type { ITtscLintPlugin } from "@ttsc/lint";
import type { TtscLintRuleSetting } from "@ttsc/lint";
import path from "node:path";
import type { IEvidenceCoverageOptions } from "./IEvidenceCoverageOptions";
import type { IEvidenceIndexOptions } from "./IEvidenceIndexOptions";
import type { IEvidenceRequireOptions } from "./IEvidenceRequireOptions";

export type { IEvidenceCoverageOptions } from "./IEvidenceCoverageOptions";
export type { IEvidenceIndexOptions } from "./IEvidenceIndexOptions";
export type { IEvidencePolicy } from "./IEvidencePolicy";
export type { IEvidenceRequireOptions } from "./IEvidenceRequireOptions";
export type { TEvidenceDeclarationKind } from "./TEvidenceDeclarationKind";

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
    // Citation obligation: declarations in configured folders must cite a
    // section under configured folders.
    "require",
    // Project-scoped. Coverage: every declared section must be cited by
    // something, or carry a stated exemption.
    "coverage",
  ] as const,
  // Absolute path so it stays valid regardless of where the consumer's
  // node_modules lives. `__dirname` is `<pkg>/lib`, so `../native` is the Go
  // source directory shipped alongside the compiled JS.
  source: path.resolve(__dirname, "..", "native"),
} satisfies ITtscLintPlugin;

declare module "@ttsc/lint" {
  interface ITtscLintRuleOptionsMap {
    "evidence/index": IEvidenceIndexOptions;
    "evidence/require": IEvidenceRequireOptions;
    "evidence/coverage": IEvidenceCoverageOptions;
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
     *
     * A dangling document anchor that closely resembles a declared one carries
     * up to three editor quick fixes. Each replaces only the anchor token; an
     * unrelated target remains a diagnostic without an invented repair.
     */
    "evidence/reference"?: TtscLintRuleSetting;
  }
}

export default plugin;
