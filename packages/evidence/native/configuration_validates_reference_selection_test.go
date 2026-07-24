package evidence

import "testing"

func decodeReferenceProblems(t *testing.T, reference string) []string {
	t.Helper()
	_, problems := decodeGraphConfig([]byte(`{"claims":[{
		"type":"typescript",
		"files":["src/**"],
		"reference":` + reference + `
	}]}`))
	return problems
}

/**
 * Verifies `file` and `files` cannot both select one population.
 *
 * They are two answers to the same question, and silently preferring one would
 * make the other look effective while selecting nothing. The message names the
 * choice rather than the offending key, because either is valid alone.
 *
 *  1. Configure both selectors on one reference.
 *  2. Decode the configuration.
 *  3. Assert the conflict is rejected.
 */
func TestConfigurationRejectsBothEntryAndGlobs(t *testing.T) {
	assertProblemContains(
		t,
		decodeReferenceProblems(t, `{"type":"typescript","file":"src/index.ts","files":["src/**"]}`),
		"select the same population two different ways",
	)
}

/**
 * Verifies a local TypeScript reference must select something.
 *
 * There is no implicit project entry: guessing one would make the population
 * depend on a convention the configuration never states, and an obligation
 * nobody declared is worse than none.
 *
 *  1. Configure a local reference with neither selector.
 *  2. Decode the configuration.
 *  3. Assert the omission is rejected and names both repairs.
 */
func TestConfigurationRejectsALocalReferenceWithNoSelector(t *testing.T) {
	assertProblemContains(
		t,
		decodeReferenceProblems(t, `{"type":"typescript"}`),
		"needs 'file' for an entry module or 'files' for globs",
	)
}

/**
 * Verifies a package reference needs no selector.
 *
 * The negative twin of the case above. A package can name its own declaration
 * entry, so requiring one from the consumer would be asking them to restate
 * what the manifest already says.
 *
 *  1. Configure a package reference with neither selector.
 *  2. Decode the configuration.
 *  3. Assert it is accepted.
 */
func TestConfigurationAcceptsAPackageReferenceWithNoSelector(t *testing.T) {
	problems := decodeReferenceProblems(t, `{"type":"typescript","package":"@org/api"}`)
	if len(problems) != 0 {
		t.Fatalf("a package reference should need no selector, got:\n%v", problems)
	}
}

/**
 * Verifies only TypeScript references accept a package.
 *
 * Markdown and Swagger evidence lives in this project. Accepting the key for
 * them would silently ignore it, leaving a configuration that reads as
 * selecting a package and does not.
 *
 *  1. Configure a package on a Markdown reference.
 *  2. Decode the configuration.
 *  3. Assert the key is rejected for that artifact kind.
 */
func TestConfigurationRejectsAPackageOnNonTypeScriptReferences(t *testing.T) {
	assertProblemContains(
		t,
		decodeReferenceProblems(t, `{"type":"markdown","package":"@org/api","files":["docs/**"]}`),
		"only a TypeScript reference can select an installed package",
	)
}

/**
 * Verifies a path in the package slot is rejected with the right repair.
 *
 * `./lib` and `@org/api/lib` are the two ways someone reaches for a local or
 * nested selection through the wrong key, and each has a different correct
 * answer, so the diagnostics differ.
 *
 *  1. Configure a relative path and a deep package path.
 *  2. Decode each configuration.
 *  3. Assert each is told which key it wanted.
 */
func TestConfigurationRejectsPathsInThePackageSlot(t *testing.T) {
	assertProblemContains(
		t,
		decodeReferenceProblems(t, `{"type":"typescript","package":"./lib"}`),
		"use 'file' or 'files' for a local population",
	)
	assertProblemContains(
		t,
		decodeReferenceProblems(t, `{"type":"typescript","package":"@org/api/lib"}`),
		"narrow it with 'file' or 'files'",
	)
}

/**
 * Verifies an entry module path must stay below its base.
 *
 * An entry escaping upward would select a population outside the project or the
 * package the reference names, which is a boundary the configuration is
 * supposed to state rather than leak past.
 *
 *  1. Configure an entry that climbs out of its base.
 *  2. Decode the configuration.
 *  3. Assert it is rejected.
 */
func TestConfigurationRejectsAnEscapingEntryModule(t *testing.T) {
	assertProblemContains(
		t,
		decodeReferenceProblems(t, `{"type":"typescript","file":"../outside/index.ts"}`),
		"must name a file below their base directory",
	)
}

/**
 * Verifies an unknown reference key is still rejected.
 *
 * Adding two keys widens the accepted set, and a decoder that stopped checking
 * would let a typo like `packages` decode to the zero value and silently select
 * the local project instead.
 *
 *  1. Configure a misspelled key.
 *  2. Decode the configuration.
 *  3. Assert it is named as unknown.
 */
func TestConfigurationStillRejectsUnknownReferenceKeys(t *testing.T) {
	assertProblemContains(
		t,
		decodeReferenceProblems(t, `{"type":"typescript","packages":"@org/api"}`),
		"unknown property",
	)
}
