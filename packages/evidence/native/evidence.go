// Package evidence is the Go rule set of `@samchon/evidence`, a `@ttsc/lint`
// contributor that turns provenance into a compile error.
//
// It ships as SOURCE, not as a module: ttsc copies this directory into
// @ttsc/lint's own Go module as a sub-package and supplies every dependency
// from the host module's graph. Two consequences follow, and both are easy to
// forget.
//
// Only the standard library and packages already in @ttsc/lint's module graph
// are importable. This package's go.mod exists for local tooling and has no say
// in the ttsc build, so a dependency that resolves under `go test ./native`
// can still be absent when ttsc links these rules. That is why the glob matcher
// here is hand-rolled rather than delegated to doublestar.
//
// The blank import ttsc synthesizes fires init() below before main, which is
// the only registration that matters. The `rules` array in ../src/index.ts is
// advisory and powers autocomplete alone.
package evidence

import (
	"github.com/samchon/ttsc/packages/lint/rule"
)

func init() {
	// Both project rules for the same reason: markdown never enters a ttsc
	// Program, so no file rule is ever dispatched for it. See index.go for the
	// index, coverage.go for why a section's diagnostic wants no file at all.
	rule.RegisterProject(indexRule{})
	rule.RegisterProject(coverageRule{})

	rule.Register(referenceRule{})
	rule.Register(requireRule{})
}
