package evidence

import (
	"strings"
	"testing"
)

/**
 * Verifies declaration validation: malformed, unresolved, and duplicate
 * acknowledgements receive distinct actionable diagnostics.
 *
 * These failures share one tag grammar but have different repairs. Collapsing
 * them into "not covered" would hide whether the author must add a reason,
 * correct a target, or remove a second acknowledgement.
 *
 *  1. Add one valid declaration and three adjacent invalid declarations.
 *  2. Evaluate them against one configured source unit.
 *  3. Assert each failure class is reported without losing coverage.
 */
func TestDeclarationsReportMalformedUnresolvedAndDuplicateCases(t *testing.T) {
	messages := runIndexRule(t, map[string]string{
		"docs/spec.md": "## Contract\n",
		"src/ref.ts": `
/** @evidence docs/spec.md#contract Primary acknowledgement. */
export interface Primary {}

/** @evidence docs/spec.md#contract */
export interface MissingReason {}

/** @evidence docs/spec.md#unknown This target does not exist. */
export interface Unknown {}

/** @evidenceExclude docs/spec.md#contract A second acknowledgement is still a duplicate. */
export interface Duplicate {}
`,
	}, `{"sources":[{
		"type":"markdown",
		"files":["docs/spec.md"],
		"symbol":"h2",
		"reference":{"type":"typescript","files":["src/ref.ts"],"symbol":"type"}
	}]}`)
	assertProblemContains(t, messages, "Malformed @evidence declaration")
	assertProblemContains(t, messages, "Unresolved evidence target 'docs/spec.md#unknown'")
	assertProblemContains(t, messages, "Duplicate acknowledgement for 'docs/spec.md#contract'")
	if countProblemsContaining(messages, "Missing acknowledgement") != 0 {
		t.Fatalf("the valid primary declaration did not cover the unit:\n%s", strings.Join(messages, "\n"))
	}
}

/**
 * Verifies JSDoc grammar boundaries: a later JSDoc tag cannot become the
 * missing reason of an evidence declaration.
 *
 * Reasons may wrap across prose lines, but `@returns`, `@example`, and other
 * tags begin new JSDoc fields. Treating one as prose would accept a declaration
 * whose mandatory explanation is still absent.
 *
 *  1. Write an `@evidence` target without a reason.
 *  2. Follow it with an unrelated JSDoc tag.
 *  3. Assert the declaration remains malformed.
 */
func TestDeclarationReasonStopsAtTheNextJSDocTag(t *testing.T) {
	messages := runIndexRule(t, map[string]string{
		"docs/spec.md": "## Contract\n",
		"src/ref.ts": `
/**
 * @evidence docs/spec.md#contract
 * @returns Nothing.
 */
export function ref(): void {}
`,
	}, `{"sources":[{
		"type":"markdown",
		"files":["docs/spec.md"],
		"symbol":"h2",
		"reference":{"type":"typescript","files":["src/ref.ts"],"symbol":"function"}
	}]}`)
	assertProblemContains(t, messages, "Malformed @evidence declaration")
	assertProblemContains(t, messages, "Missing acknowledgement")
}

/**
 * Verifies ambiguous resolution: two distinct TypeScript declarations with the
 * same public target cannot be selected by declaration order.
 *
 * TypeScript targets intentionally omit file paths. When separate files export
 * the same qualified name, choosing the first would make filesystem order part
 * of graph identity and silently redirect evidence.
 *
 *  1. Materialize `Shared` from two source files.
 *  2. Cite `Shared` from a Markdown reference.
 *  3. Assert the target is ambiguous and names both declarations.
 */
func TestDeclarationsRejectAmbiguousTypeScriptTargets(t *testing.T) {
	messages := runIndexRule(t, map[string]string{
		"src/a.ts": "export interface Shared {}\n",
		"src/b.ts": "export interface Shared {}\n",
		"docs/ref.md": `# Reference
<!-- @evidence Shared This document relies on the shared type. -->
`,
	}, `{"sources":[{
		"type":"typescript",
		"files":["src/*.ts"],
		"reference":{"type":"markdown","files":["docs/ref.md"],"symbol":"h1"}
	}]}`)
	assertProblemContains(t, messages, "Ambiguous evidence target 'Shared'")
	assertProblemContains(t, messages, "src/a.ts")
	assertProblemContains(t, messages, "src/b.ts")
}

/**
 * Verifies reference host scope: a resolvable declaration on an unselected
 * symbol kind does not satisfy coverage.
 *
 * Resolution and host eligibility are separate checks. Treating every JSDoc
 * tag in a matched file as valid would make a property-only reference selector
 * indistinguishable from the all-symbol default.
 *
 *  1. Select only TypeScript property hosts.
 *  2. Put a valid target on an exported function.
 *  3. Assert both the out-of-scope host and missing acknowledgement.
 */
func TestDeclarationsRejectOutOfScopeSymbolHosts(t *testing.T) {
	messages := runIndexRule(t, map[string]string{
		"docs/spec.md": "## Contract\n",
		"src/ref.ts": `
/** @evidence docs/spec.md#contract This function is outside the selected host kind. */
export function ref(): void {}
`,
	}, `{"sources":[{
		"type":"markdown",
		"files":["docs/spec.md"],
		"symbol":"h2",
		"reference":{"type":"typescript","files":["src/ref.ts"],"symbol":"property"}
	}]}`)
	assertProblemContains(t, messages, "Out-of-scope @evidence host")
	assertProblemContains(t, messages, "host kind 'function' is not selected")
	assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#contract'")
}

/**
 * Verifies TypeScript reference defaults: type, function, and qualified
 * property hosts all accept evidence declarations when symbol is omitted.
 *
 * The reference default is the union of all supported kinds, unlike the source
 * default. This complete graph proves each host can fire rather than trusting a
 * quiet rule with only one declaration shape.
 *
 *  1. Materialize three Markdown headings.
 *  2. Cite them from an interface, function, and interface property.
 *  3. Assert the omitted reference selector accepts every host kind.
 */
func TestTypeScriptReferenceDefaultAcceptsEverySymbolKind(t *testing.T) {
	messages := runIndexRule(t, map[string]string{
		"docs/spec.md": `## Type
## Function
## Property
`,
		"src/ref.ts": `
/** @evidence docs/spec.md#type The type adopts this section. */
export interface Ref {
  /** @evidence docs/spec.md#property The property adopts this section. */
  value: string;
}

/** @evidence docs/spec.md#function The function adopts this section. */
export function execute(): void {}
`,
	}, `{"sources":[{
		"type":"markdown",
		"files":["docs/spec.md"],
		"symbol":"h2",
		"reference":{"type":"typescript","files":["src/ref.ts"]}
	}]}`)
	assertNoProblems(t, messages)
}
