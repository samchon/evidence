package evidence

import (
	"testing"

	"github.com/samchon/ttsc/packages/lint/rule"
)

// Verifies the completion corpus's trigger layering.
//
// The three cases are made mutually exclusive by the host's longest-After-wins
// rule, not by anything in the corpus itself, so the layering is only correct if
// the triggers nest exactly: `@` ⊂ `@evidence ` ⊂ `@evidence <path>#`. Nothing
// enforces that but this test. Get a trailing space wrong and the trigger stops
// ending where the completed token begins — the token swallows the separator,
// the editor filters on `docs/spec.md#pri` instead of `pri`, and every anchor
// silently stops matching while the corpus still looks populated.
//
//  1. Build an index with one document and two sections.
//  2. Ask the rule for its corpus.
//  3. Assert the tag, path, and anchor triggers nest, and that anchors are
//     scoped to their own document.
func TestHintsLayerTriggersLongestWins(t *testing.T) {
	index := &evidenceIndex{
		Documents: map[string][]documentSection{
			"docs/spec.md": {
				{Anchor: "pricing", Title: "Pricing"},
				{Anchor: "refunds", Title: "Refunds"},
			},
		},
		Symbols: map[string]bool{},
	}
	hints := indexRule{}.Hints(&rule.HintContext{State: index})
	if len(hints) == 0 {
		t.Fatal("the rule published no hints at all")
	}

	byTrigger := map[string][]rule.Hint{}
	for _, hint := range hints {
		if hint.Trigger.Scope != rule.HintScopeJSDoc {
			t.Errorf("hint %q escaped the JSDoc scope: %q", hint.Insert, hint.Trigger.Scope)
		}
		byTrigger[hint.Trigger.After] = append(byTrigger[hint.Trigger.After], hint)
	}

	// The tag name, offered where the user has typed only `@`.
	if got := insertsFor(byTrigger, "@"); len(got) != 1 || got[0] != "evidence" {
		t.Errorf("trigger `@` offered %v, want [evidence]", got)
	}

	// The document path. The trailing space is what makes the editor filter on
	// `docs/sp` rather than on `@evidence docs/sp`.
	if got := insertsFor(byTrigger, "@evidence "); len(got) != 1 || got[0] != "docs/spec.md" {
		t.Errorf("trigger `@evidence ` offered %v, want [docs/spec.md]", got)
	}

	// Anchors are scoped to their own document by naming it in the trigger.
	// That is what lets a literal trigger do a pattern's job.
	anchors := insertsFor(byTrigger, "@evidence docs/spec.md#")
	if len(anchors) != 2 || anchors[0] != "pricing" || anchors[1] != "refunds" {
		t.Errorf("trigger `@evidence docs/spec.md#` offered %v, want [pricing refunds]", anchors)
	}

	// The negative twin: no hint may sit on a trigger nobody would type. A
	// corpus keyed on `@evidence` without the space would match the same lines
	// as the path trigger and fight it.
	if _, exists := byTrigger["@evidence"]; exists {
		t.Error("a trigger without the trailing space would shadow the path trigger")
	}
}

// Verifies that explicit anchors rank before derived anchors.
//
// Slice order is the only ranking channel a serialized corpus has. An explicit
// `{#id}` survives an edit to the heading text and a derived anchor does not, so
// offering the fragile one first would teach authors to cite it — and then
// `evidence/reference` would blame them for taking what the editor handed over.
//
//  1. Build a document whose derived section precedes its explicit one.
//  2. Ask for the corpus.
//  3. Assert the explicit anchor is offered first regardless of document order.
func TestHintsRankExplicitAnchorsFirst(t *testing.T) {
	index := &evidenceIndex{
		Documents: map[string][]documentSection{
			"docs/spec.md": {
				{Anchor: "derived-first", Title: "Derived First"},
				{Anchor: "stable", Title: "Stable", Explicit: true},
			},
		},
		Symbols: map[string]bool{},
	}
	hints := indexRule{}.Hints(&rule.HintContext{State: index})

	anchors := []string{}
	for _, hint := range hints {
		if hint.Trigger.After == "@evidence docs/spec.md#" {
			anchors = append(anchors, hint.Insert)
		}
	}
	if len(anchors) != 2 || anchors[0] != "stable" {
		t.Errorf("anchors offered %v, want the explicit one first", anchors)
	}
}

// Verifies that an absent or unreadable index state publishes no hints.
//
// The host calls Hints only for a rule that passed and published, so a state
// this rule cannot read means it published something other than it believes.
// Returning a corpus anyway would complete against facts nothing established.
//
//  1. Ask for hints with no state and with a state of the wrong type.
//  2. Assert both calls stay silent instead of inventing a corpus.
func TestHintsWithoutStateStaySilent(t *testing.T) {
	if hints := (indexRule{}).Hints(&rule.HintContext{State: nil}); hints != nil {
		t.Errorf("a nil state produced %d hints, want none", len(hints))
	}
	if hints := (indexRule{}).Hints(&rule.HintContext{State: "not an index"}); hints != nil {
		t.Errorf("an unreadable state produced %d hints, want none", len(hints))
	}
}

func insertsFor(byTrigger map[string][]rule.Hint, after string) []string {
	inserts := []string{}
	for _, hint := range byTrigger[after] {
		inserts = append(inserts, hint.Insert)
	}
	return inserts
}
