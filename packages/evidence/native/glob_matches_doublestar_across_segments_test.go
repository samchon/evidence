package evidence

import "testing"

// TestGlobMatchesDoublestarAcrossSegments pins the folder-policy matcher.
//
// This matcher is hand-rolled because ttsc resolves this package's imports from
// @ttsc/lint's module graph, so doublestar is unavailable and path.Match is
// unusable — its `*` refuses to cross a separator, which is the only thing a
// `src/**/*.ts` policy needs. That makes every case here a property nothing
// else in the toolchain guarantees.
//
//  1. `**` spans zero, one, and many segments.
//  2. `*` and `?` stay inside one segment.
//  3. An empty pattern set matches nothing rather than everything.
func TestGlobMatchesDoublestarAcrossSegments(t *testing.T) {
	cases := []struct {
		pattern string
		name    string
		want    bool
	}{
		// `**` spans zero segments — the boundary that a naive
		// "consume at least one" implementation silently fails.
		{"docs/**/*.md", "docs/spec.md", true},
		{"docs/**/*.md", "docs/analysis/spec.md", true},
		{"docs/**/*.md", "docs/a/b/c/spec.md", true},
		{"**/*.md", "spec.md", true},
		{"**", "a/b/c", true},

		// A single `*` must not cross a separator.
		{"docs/*.md", "docs/analysis/spec.md", false},
		{"src/*/index.ts", "src/a/index.ts", true},
		{"src/*/index.ts", "src/a/b/index.ts", false},

		// `?` is exactly one character, inside one segment.
		{"v?.md", "v1.md", true},
		{"v?.md", "v10.md", false},
		{"a?c", "a/c", false},

		// Extension and prefix discrimination.
		{"docs/**/*.md", "docs/spec.ts", false},
		{"src/api/**", "src/apiary/x.ts", false},

		// Case is identity. A case-insensitive host still has one true
		// spelling, and admitting the wrong one yields a reference the index
		// cannot resolve.
		{"docs/**/*.md", "Docs/spec.md", false},

		// Leading ./ is noise, not meaning.
		{"./docs/*.md", "docs/spec.md", true},
	}
	for _, entry := range cases {
		if got := matchGlob(entry.pattern, entry.name); got != entry.want {
			t.Errorf(
				"matchGlob(%q, %q) = %v, want %v",
				entry.pattern, entry.name, got, entry.want,
			)
		}
	}

	if matchAnyGlob(nil, "docs/spec.md") {
		t.Error("an empty pattern set must match nothing, not everything")
	}
	if !matchAnyGlob([]string{"nope/*", "docs/*.md"}, "docs/spec.md") {
		t.Error("matchAnyGlob must match when any pattern matches")
	}
}
