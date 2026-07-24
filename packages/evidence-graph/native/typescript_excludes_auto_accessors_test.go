package evidence

import (
	"sort"
	"strings"
	"testing"
)

/**
 * Verifies auto-accessor classification: callable syntax behind an accessor
 * does not create a function evidence unit.
 *
 * Auto-accessors share PropertyDeclaration shape with ordinary function-valued
 * fields but retain accessor semantics. The positive fields and instance/static
 * accessor twins pin the modifier boundary.
 *
 *  1. Declare callable fields and callable auto-accessors.
 *  2. Collect the function inventory.
 *  3. Assert only ordinary fields materialize.
 */
func TestTypeScriptAutoAccessorsAreNotFunctionUnits(t *testing.T) {
	inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export class Service {
  handler = (): void => {};
  static factory: () => void;
  accessor callback = (): void => {};
  static accessor provider: () => void;
}
`)
	targets := []string{}
	for _, unit := range inventory.Units {
		targets = append(targets, unit.Symbol+":"+unit.Target)
	}
	sort.Strings(targets)
	want := []string{
		"function:Service.factory",
		"function:Service.prototype.handler",
	}
	if strings.Join(targets, "\n") != strings.Join(want, "\n") {
		t.Fatalf(
			"auto-accessor callable units:\n%s\nwant:\n%s",
			strings.Join(targets, "\n"),
			strings.Join(want, "\n"),
		)
	}
}

/**
 * Verifies auto-accessor claim hosts: JSDoc on an accessor stays outside a
 * function-only claim even when its initializer is callable.
 *
 * Excluding only the source unit is insufficient because supported-host
 * collection can still accept the same declaration as an outgoing function
 * claim.
 *
 *  1. Attach evidence to a callable auto-accessor.
 *  2. Select function hosts and one Markdown heading.
 *  3. Assert the declaration is reported as unsupported.
 */
func TestTypeScriptAutoAccessorsAreNotFunctionClaimHosts(t *testing.T) {
	messages := runIndexRule(t, map[string]string{
		"docs/spec.md": "## Contract\n",
		"src/contracts.ts": `
export class Service {
  /** @evidence docs/spec.md#contract This accessor cannot claim function evidence. */
  accessor callback = (): void => {};
}
`,
	}, `{"claims":[{
		"type":"typescript",
		"files":["src/contracts.ts"],
		"symbol":"function",
		"reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
	}]}`)
	assertProblemContains(t, messages, "unsupported or non-exported declaration")
}
