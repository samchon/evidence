package evidence

import "testing"

// TestTagSplitsTargetFromReason pins the `@evidence <target> <reason>` grammar.
//
// The split is the whole contract with authors, and the reason it is safe is
// that this is the ordinary JSDoc shape (`@param name description`): the first
// token is the key and the rest is prose. A reason contains spaces, so getting
// the boundary wrong does not fail loudly — it silently truncates the reason or
// swallows the target into it, and the graph fills with references nobody can
// read.
//
//  1. A target and a multi-word reason split at the first whitespace only.
//  2. A bare target parses with an empty reason rather than failing to parse.
//  3. An empty body does not parse.
func TestTagSplitsTargetFromReason(t *testing.T) {
	cases := []struct {
		comment string
		target  string
		reason  string
		ok      bool
	}{
		{
			"docs/spec.md#pricing Sale price derives from the rule defined there.",
			"docs/spec.md#pricing",
			"Sale price derives from the rule defined there.",
			true,
		},
		// A bare target must parse. It is a rule violation, not a syntax error,
		// and the two deserve different diagnostics.
		{"docs/spec.md#pricing", "docs/spec.md#pricing", "", true},
		// Leading and internal whitespace must not corrupt the split.
		{"   IShoppingSale.IUpdate   Mirrors it.  ", "IShoppingSale.IUpdate", "Mirrors it.", true},
		// A reason spanning lines keeps its remainder.
		{"a.md#b line one\nline two", "a.md#b", "line one\nline two", true},
		{"", "", "", false},
		{"   ", "", "", false},
	}
	for _, entry := range cases {
		target, reason, ok := parseEvidenceComment(entry.comment)
		if ok != entry.ok || target != entry.target || reason != entry.reason {
			t.Errorf(
				"parseEvidenceComment(%q) = (%q, %q, %v), want (%q, %q, %v)",
				entry.comment, target, reason, ok,
				entry.target, entry.reason, entry.ok,
			)
		}
	}
}

// TestTagClassifiesTargetKind pins the document-versus-symbol discriminator.
//
// This is a heuristic, so its negative twins matter more than its positives: a
// misclassification does not crash, it produces a confident diagnostic about
// the wrong node kind ("no such symbol docs/spec"), which sends the author
// hunting in the wrong place.
//
//  1. A '#' or a '.md' suffix means a document.
//  2. A path-shaped target without '.md' is still a document, not a symbol.
//  3. A dotted identifier is a symbol.
func TestTagClassifiesTargetKind(t *testing.T) {
	cases := []struct {
		target string
		kind   referenceKind
		path   string
		anchor string
	}{
		{"docs/spec.md#pricing", referenceKindDocument, "docs/spec.md", "pricing"},
		{"docs/spec.md", referenceKindDocument, "docs/spec.md", ""},
		{"spec.md", referenceKindDocument, "spec.md", ""},
		// Path-shaped without an extension: calling this a symbol would name
		// the wrong mistake back to the author.
		{"docs/spec", referenceKindDocument, "docs/spec", ""},
		// A bare anchor on the current document is still a document reference.
		{"#pricing", referenceKindDocument, "", "pricing"},

		// Symbols: the dotted form must not be mistaken for a path.
		{"IShoppingSale", referenceKindSymbol, "", ""},
		{"IShoppingSale.IUpdate", referenceKindSymbol, "", ""},

		{"", referenceKindUnknown, "", ""},
	}
	for _, entry := range cases {
		kind, path, anchor := classifyTarget(entry.target)
		if kind != entry.kind || path != entry.path || anchor != entry.anchor {
			t.Errorf(
				"classifyTarget(%q) = (%v, %q, %q), want (%v, %q, %q)",
				entry.target, kind, path, anchor,
				entry.kind, entry.path, entry.anchor,
			)
		}
	}
}
