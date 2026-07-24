package evidence

import "testing"

const packageManifest = `{
  "name": "@org/api",
  "main": "./lib/index.js",
  "exports": { ".": { "types": "./lib/index.d.ts", "default": "./lib/index.js" } }
}`

/**
 * Verifies a package reference materializes a symbol nothing imports.
 *
 * This is the reason the population is read from disk rather than the Program.
 * An operation the frontend never called is absent from `ctx.Sources` by
 * definition, and it is exactly the operation an obligation has to name — a
 * graph that could only see imported symbols would report full coverage of the
 * work already done.
 *
 *  1. Install a package declaring two operations and import neither.
 *  2. Select the package as evidence.
 *  3. Assert both are demanded, including the one nothing references.
 */
func TestGraphMaterializesPackageSymbolsNothingImports(t *testing.T) {
	messages := runIndexRule(t, map[string]string{
		"node_modules/@org/api/package.json": packageManifest,
		"node_modules/@org/api/lib/index.d.ts": `
export declare function get(): void;
export declare function erase(): void;
`,
		"src/views/detail.ts": "export function detail(): void {}\n",
	}, `{"claims":[{
		"type":"typescript",
		"files":["src/views/**"],
		"symbol":"function",
		"reference":{"type":"typescript","package":"@org/api","symbol":"function"}
	}]}`)
	assertProblemContains(t, messages, "Missing acknowledgement for 'get'")
	assertProblemContains(t, messages, "Missing acknowledgement for 'erase'")
}

/**
 * Verifies the package entry comes from the `types` condition, not from `main`.
 *
 * `main` names the JavaScript a consumer runs; a citation addresses
 * declarations. Following `main` would resolve to a file with no types at all
 * and report an empty population as a satisfied obligation.
 *
 *  1. Point `main` at a JavaScript file and `types` at the declarations.
 *  2. Select the package and acknowledge what its declarations expose.
 *  3. Assert silence, which is only reachable through the `types` condition.
 */
func TestGraphReadsThePackageEntryFromItsTypesCondition(t *testing.T) {
	assertNoProblems(t, runIndexRule(t, map[string]string{
		"node_modules/@org/api/package.json":   packageManifest,
		"node_modules/@org/api/lib/index.js":   "export function get() {}\n",
		"node_modules/@org/api/lib/index.d.ts": "export declare function get(): void;\n",
		"src/views/detail.ts": `
import type * as api from "@org/api";

/** @evidence {@link api.get} Renders this operation's response. */
export function detail(): void {}
`,
	}, `{"claims":[{
		"type":"typescript",
		"files":["src/views/**"],
		"symbol":"function",
		"reference":{"type":"typescript","package":"@org/api","symbol":"function"}
	}]}`))
}

/**
 * Verifies a bare `types` field is honored when there is no exports map.
 *
 * Older packages ship exactly this shape, and a resolver that only understood
 * `exports` would silently reach nothing for them.
 *
 *  1. Publish a package whose manifest carries only `types`.
 *  2. Select it as evidence.
 *  3. Assert its symbol is demanded.
 */
func TestGraphReadsThePackageEntryFromABareTypesField(t *testing.T) {
	assertProblemContains(t, runIndexRule(t, map[string]string{
		"node_modules/legacy-api/package.json": `{"name":"legacy-api","types":"./index.d.ts"}`,
		"node_modules/legacy-api/index.d.ts":   "export declare function get(): void;\n",
		"src/views/detail.ts":                  "export function detail(): void {}\n",
	}, `{"claims":[{
		"type":"typescript",
		"files":["src/views/**"],
		"symbol":"function",
		"reference":{"type":"typescript","package":"legacy-api","symbol":"function"}
	}]}`), "Missing acknowledgement for 'get'")
}

/**
 * Verifies globs inside a package resolve against the package root.
 *
 * Narrowing a large SDK to one area is the difference between an obligation a
 * team can adopt and one they switch off. Resolving those globs against the
 * project root instead would match nothing and read as a satisfied population.
 *
 *  1. Publish a package with two areas.
 *  2. Narrow the reference to one of them with a package-relative glob.
 *  3. Assert only that area is demanded.
 */
func TestGraphResolvesPackageGlobsAgainstThePackageRoot(t *testing.T) {
	messages := runIndexRule(t, map[string]string{
		"node_modules/@org/api/package.json":           packageManifest,
		"node_modules/@org/api/lib/index.d.ts":         "export declare function root(): void;\n",
		"node_modules/@org/api/lib/questions/get.d.ts": "export declare function get(): void;\n",
		"node_modules/@org/api/lib/reviews/erase.d.ts": "export declare function erase(): void;\n",
		"src/views/detail.ts":                          "export function detail(): void {}\n",
	}, `{"claims":[{
		"type":"typescript",
		"files":["src/views/**"],
		"symbol":"function",
		"reference":{"type":"typescript","package":"@org/api","files":["lib/questions/**"],"symbol":"function"}
	}]}`)
	assertProblemContains(t, messages, "Missing acknowledgement for 'get'")
	if countProblemsContaining(messages, "Missing acknowledgement for 'erase'") != 0 {
		t.Fatalf("a package glob leaked outside the area it selected:\n%v", messages)
	}
}

/**
 * Verifies an uninstalled package is reported rather than silently empty.
 *
 * A population that resolves to nothing produces no obligations, and coverage
 * would then pass. Naming the resolution order tells the author which of the
 * three manifest fields to correct.
 *
 *  1. Select a package that is not installed.
 *  2. Evaluate the graph.
 *  3. Assert the failure names the package and the entry resolution order.
 */
func TestGraphReportsAnUnresolvablePackageReference(t *testing.T) {
	assertProblemContains(t, runIndexRule(t, map[string]string{
		"src/views/detail.ts": "export function detail(): void {}\n",
	}, `{"claims":[{
		"type":"typescript",
		"files":["src/views/**"],
		"symbol":"function",
		"reference":{"type":"typescript","package":"@org/absent","symbol":"function"}
	}]}`), "could not resolve the declaration entry of package '@org/absent'")
}
