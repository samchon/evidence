import type { ITtscLintPlugin } from "@ttsc/lint";
import path from "node:path";
import type { IEvidenceGraphConfig } from "./structures";

export type {
  EvidenceGraphHeadingLevel,
  EvidenceGraphTypeScriptSymbol,
  IEvidenceGraphConfig,
  IEvidenceGraphHeadingRange,
  IEvidenceGraphMarkdownReference,
  IEvidenceGraphMarkdownSource,
  IEvidenceGraphReference,
  IEvidenceGraphSource,
  IEvidenceGraphTypeScriptReference,
  IEvidenceGraphTypeScriptSource,
} from "./structures";

// `@samchon/evidence-graph` — a `@ttsc/lint` rule contributor.
//
// This descriptor mirrors the shape of an ESLint flat-config plugin object
// (meta + rules) with one field that carries runtime meaning: `source`. It
// points at this package's Go source directory (`../native`), which ttsc's
// plugin builder statically links into `@ttsc/lint`'s binary on first build.
//
// The `rules` array is advisory — the authoritative registration happens in the
// Go `init()` of `native/evidence.go` via `rule.Register(...)`. Declaring the
// names here only powers TypeScript autocomplete for `evidence-graph/*` keys in a
// consumer's lint config, and a name listed here but never registered in Go
// fails silently at runtime rather than loudly at build.
const plugin = {
  meta: {
    name: "@samchon/evidence-graph",
    version: "0.1.0",
    namespace: "evidence-graph",
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
export default plugin;

declare module "@ttsc/lint" {
  interface ITtscLintRuleOptionsMap {
    "evidence-graph/index": IEvidenceGraphConfig;
  }
}
