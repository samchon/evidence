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

    /**
     * Requires declarations in configured folders to cite a document section
     * under configured folders.
     *
     * This is the source-side question, and it is a third question rather than
     * a variant of the other two. `evidence/reference` asks whether a citation
     * points at something real. A coverage rule would ask which declared
     * section nothing has proven. This asks which declaration asserts something
     * while citing nothing at all.
     *
     * **Configure this rule once, in a single entry, with every policy in the
     * `policies` array.** Splitting policies across config entries does not
     * accumulate and does not warn: a rule setting has no `files` key at all
     * (`files` lives only on the top-level config object), a config file is one
     * object rather than an array, and `extends` takes a single string — so one
     * config file contributes at most one rules entry, and where two do match,
     * the later entry's options replace the earlier outright.
     *
     * **Adoption is authorship, not configuration.** Enabling a broad policy on
     * an existing codebase produces hundreds of errors at once, and the
     * cheapest way to clear them is to write a plausible citation on each —
     * which yields a graph that is fully covered, largely false, and
     * permanently indistinguishable from a real one. Start from a folder small
     * enough to cite honestly and widen the glob deliberately. The glob is the
     * ratchet: it is diffable, reviewable, and states which folders are under
     * discipline.
     */
    "evidence/require": {
      /**
       * Citation obligations. **Every** matching policy applies — these are
       * demands, not allow/deny effects, so they compose rather than shadow. A
       * declaration selected by two policies must satisfy both.
       */
      policies?: readonly IEvidencePolicy[];
    };

    /**
     * Reports declared sections that nothing cites.
     *
     * This is the target-side question, the third of three.
     * `evidence/reference` asks whether a citation points at something real;
     * `evidence/require` asks whether a declaration asserts something while
     * citing nothing; this asks which section of the design nothing in the code
     * claims to implement.
     *
     * Its blindness is structural: it counts sections with no citation, so it
     * can never see a citation with no section. That is `evidence/reference`'s
     * job. Enabling one does not cover the other.
     *
     * Project-scoped, so it must be configured in an entry with no `files` key.
     * Its findings name a markdown section and therefore carry no file and no
     * line — a section has no TypeScript node to point at.
     *
     * A section that genuinely needs no citation says so in the document, under
     * its heading:
     *
     * ```md
     * ## Naming Conventions
     *
     * <!-- evidence-exempt: describes a convention, not behavior anything implements -->
     * ```
     *
     * The reason is mandatory; a marker with a blank reason is an error rather
     * than an exemption. The marker lives in the document because that is where
     * the uncited thing lives, and it is an HTML comment so it stays invisible
     * in every renderer while remaining reviewable in the source.
     */
    "evidence/coverage": {
      /**
       * Documents whose sections must be cited. Defaults to every indexed
       * document.
       *
       * Narrow this rather than exempting sections one by one when a whole
       * document is reference material. Adoption is authorship: a small
       * demanded set that is honestly covered beats a large one cleared by
       * citations written to silence errors.
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

/**
 * One "declarations here must cite sections there" obligation.
 *
 * Both globs are project-relative and support `**`, `*`, and `?`. Matching is
 * case-sensitive even on a case-insensitive filesystem, because a path has one
 * true spelling.
 */
export interface IEvidencePolicy {
  /**
   * Source files this policy governs.
   *
   * An empty or missing list matches nothing, never everything. A policy that
   * lost its globs goes quiet rather than placing the whole repository under
   * obligation.
   */
  files: readonly string[];

  /**
   * Documents whose sections discharge this obligation.
   *
   * A declaration satisfies the policy when at least one of its `@evidence`
   * tags cites a **section** of a document matching one of these globs.
   *
   * Only document sections count. A symbol citation is still checked for
   * integrity by `evidence/reference`, but it cannot ground a declaration: a
   * symbol both cites and is cited, so two declarations naming each other would
   * satisfy every obligation between them while proving nothing. A section is
   * terminal, which is what makes it grounds.
   */
  targets: readonly string[];

  /**
   * Declaration kinds under obligation.
   *
   * Defaults to `["interface", "type", "class", "function", "enum"]` — the
   * declarations that carry a design decision. `variable` and `namespace` are
   * opt-in because most are plumbing, and demanding grounds for every exported
   * constant trains authors to write filler, which is worse than demanding
   * nothing.
   *
   * Only exported, top-level declarations are ever obliged. A module-private
   * declaration is an implementation detail of something already under
   * obligation.
   */
  kinds?: readonly (
    | "interface"
    | "type"
    | "class"
    | "function"
    | "enum"
    | "variable"
    | "namespace"
  )[];

  /**
   * Replaces the default diagnostic.
   *
   * Prefer the default. It distinguishes "cited nothing" from "cited the wrong
   * place" — two mistakes with the same symptom and different repairs — and a
   * fixed string collapses them back together.
   */
  message?: string;
}

export default plugin;
