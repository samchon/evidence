package evidence

import (
	"strings"
	"testing"
)

/**
 * Verifies reference independence: complementary partial reference groups
 * cannot pool their acknowledgements into one complete source.
 *
 * Each group sees the same two-unit denominator but acknowledges the opposite
 * half. A union-based implementation would report success even though neither
 * population can account for the complete source.
 *
 *  1. Materialize two Markdown evidence units.
 *  2. Let each of two TypeScript groups acknowledge only one unit.
 *  3. Assert each group reports its own missing twin.
 */
func TestReferenceGroupsCannotPoolPartialCoverage(t *testing.T) {
	messages := runIndexRule(t, map[string]string{
		"docs/spec.md": `## Create
## Cancel
`,
		"src/a.ts": `
/** @evidence docs/spec.md#create Group A implements creation. */
export function create(): void {}
`,
		"src/b.ts": `
/** @evidence docs/spec.md#cancel Group B implements cancellation. */
export function cancel(): void {}
`,
	}, `{"sources":[{
		"type":"markdown",
		"files":["docs/spec.md"],
		"symbol":"h2",
		"reference":[
			{"type":"typescript","files":["src/a.ts"],"symbol":"function"},
			{"type":"typescript","files":["src/b.ts"],"symbol":"function"}
		]
	}]}`)
	if got := countProblemsContaining(messages, "Missing acknowledgement"); got != 2 {
		t.Fatalf("partial reference groups produced %d missing findings:\n%s", got, strings.Join(messages, "\n"))
	}
	assertProblemContains(t, messages, "'docs/spec.md#cancel'")
	assertProblemContains(t, messages, "reference 1")
	assertProblemContains(t, messages, "'docs/spec.md#create'")
	assertProblemContains(t, messages, "reference 2")
}

/**
 * Verifies source independence: one source entry's complete reference group
 * does not discharge another source entry selecting the same artifact unit.
 *
 * The target text is deliberately identical in both sources. The only boundary
 * available is the owning configuration entry, so coverage must be stored under
 * source and reference indices rather than under target alone.
 *
 *  1. Select the same Markdown heading from two named sources.
 *  2. Acknowledge it only in the first source's reference files.
 *  3. Assert the second source remains incomplete.
 */
func TestSourcesCannotShareAcknowledgementState(t *testing.T) {
	messages := runIndexRule(t, map[string]string{
		"docs/shared.md": "## Contract\n",
		"src/a.ts": `
/** @evidence docs/shared.md#contract Source A adopts the contract. */
export interface A {}
`,
		"src/b.ts": "export interface B {}\n",
	}, `{"sources":[
		{
			"type":"markdown",
			"name":"Population A",
			"files":["docs/shared.md"],
			"symbol":"h2",
			"reference":{"type":"typescript","files":["src/a.ts"],"symbol":"type"}
		},
		{
			"type":"markdown",
			"name":"Population B",
			"files":["docs/shared.md"],
			"symbol":"h2",
			"reference":{"type":"typescript","files":["src/b.ts"],"symbol":"type"}
		}
	]}`)
	if got := countProblemsContaining(messages, "Missing acknowledgement"); got != 1 {
		t.Fatalf("source-local coverage produced %d missing findings:\n%s", got, strings.Join(messages, "\n"))
	}
	assertProblemContains(t, messages, "Source 2 ('Population B')")
}

/**
 * Verifies diagnostic-only names: adding a source name improves messages but
 * does not enter target identity or graph matching.
 *
 * A label accidentally used as an identity would make the same declaration
 * resolve in an unnamed graph and dangle in a named one. The green pair below
 * pins semantic equality, and the failing case pins diagnostic visibility.
 *
 *  1. Resolve the same target with and without a source name.
 *  2. Assert both complete graphs are green.
 *  3. Remove the declaration and assert only the named diagnostic text changes.
 */
func TestSourceNameChangesDiagnosticsButNotGraphBehavior(t *testing.T) {
	files := map[string]string{
		"docs/spec.md": "## Contract\n",
		"src/ref.ts": `
/** @evidence docs/spec.md#contract This type adopts the contract. */
export interface Ref {}
`,
	}
	baseSource := `"type":"markdown","files":["docs/spec.md"],"symbol":"h2","reference":{"type":"typescript","files":["src/ref.ts"],"symbol":"type"}`
	assertNoProblems(t, runIndexRule(t, files, `{"sources":[{`+baseSource+`}]}`))
	assertNoProblems(t, runIndexRule(t, files, `{"sources":[{"name":"Friendly label",`+baseSource+`}]}`))

	missingFiles := map[string]string{
		"docs/spec.md": "## Contract\n",
		"src/ref.ts":   "export interface Ref {}\n",
	}
	messages := runIndexRule(t, missingFiles, `{"sources":[{"name":"Friendly label",`+baseSource+`}]}`)
	assertProblemContains(t, messages, "Source 1 ('Friendly label')")
	assertProblemContains(t, messages, "'docs/spec.md#contract'")
}
