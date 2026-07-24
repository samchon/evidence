package evidence

import (
	"sort"
	"strings"
	"testing"
)

/**
 * Verifies destructured exports: every public binding leaf materializes under
 * its local or aliased export name as a property.
 *
 * Object and array binding patterns have no declaration-level identifier.
 * Recursing through their leaves must preserve renamed, nested, rest, namespace,
 * and later export-list bindings without guessing callable values.
 *
 *  1. Export representative object and array binding patterns.
 *  2. Add namespace, alias, and private negative twins.
 *  3. Assert the exact public property inventory.
 */
func TestTypeScriptDestructuredExportsMaterializeBindingLeaves(t *testing.T) {
	inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
const source = {
  state: "ready",
  count: 1,
  nested: { enabled: true },
  extra: "rest",
};
const values = [1, 2, 3];

export const {
  state,
  count: publicCount,
  nested: { enabled = false },
  ...remaining,
} = source;
export const [first, , ...tail] = values;

const { extra: local } = source;
export { local as publicLocal };

const { state: hidden } = source;

export namespace Api {
  const source = { status: "ok", hidden: false };
  export const { status: current } = source;
  const { hidden } = source;
}
`)
	units := []string{}
	for _, unit := range inventory.Units {
		units = append(units, unit.Symbol+":"+unit.Target)
	}
	sort.Strings(units)
	want := []string{
		"property:Api.current",
		"property:enabled",
		"property:first",
		"property:publicCount",
		"property:publicLocal",
		"property:remaining",
		"property:state",
		"property:tail",
		"type:Api",
	}
	sort.Strings(want)
	if strings.Join(units, "\n") != strings.Join(want, "\n") {
		t.Fatalf(
			"destructured export units:\n%s\nwant:\n%s",
			strings.Join(units, "\n"),
			strings.Join(want, "\n"),
		)
	}
}

/**
 * Verifies destructured claim hosts: statement JSDoc remains eligible for the
 * property bindings resident in an exported pattern.
 *
 * TypeScript attaches leading JSDoc to the variable statement wrapper, while
 * public identities live on nested binding elements. Both nodes must receive
 * the same property-host result.
 *
 *  1. Attach evidence to an exported object binding pattern.
 *  2. Select property hosts and one Markdown heading.
 *  3. Assert the complete rule accepts the host.
 */
func TestTypeScriptDestructuredExportStatementsAreClaimHosts(t *testing.T) {
	messages := runIndexRule(t, map[string]string{
		"docs/spec.md": "## Contract\n",
		"src/contracts.ts": `
const source = { state: "ready" };
/** @evidence docs/spec.md#contract This binding exposes the contract state. */
export const { state } = source;
`,
	}, `{"claims":[{
		"type":"typescript",
		"files":["src/contracts.ts"],
		"symbol":"property",
		"reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
	}]}`)
	assertNoProblems(t, messages)
}
