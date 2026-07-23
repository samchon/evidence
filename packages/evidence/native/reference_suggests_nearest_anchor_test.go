package evidence

import (
	"strings"
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"

	"github.com/samchon/ttsc/packages/lint/rule"
)

type anchorSuggestionCapture struct {
	rangeReports      int
	suggestionReports int
	pos               int
	end               int
	message           string
	suggestions       []rule.Suggestion
}

func (capture *anchorSuggestionCapture) Report(*shimast.Node, string) {}

func (capture *anchorSuggestionCapture) ReportRange(pos, end int, message string) {
	capture.rangeReports++
	capture.pos = pos
	capture.end = end
	capture.message = message
}

func (capture *anchorSuggestionCapture) ReportSuggestion(
	*shimast.Node,
	string,
	...rule.Suggestion,
) {
}

func (capture *anchorSuggestionCapture) ReportRangeSuggestion(
	pos int,
	end int,
	message string,
	suggestions ...rule.Suggestion,
) {
	capture.suggestionReports++
	capture.pos = pos
	capture.end = end
	capture.message = message
	capture.suggestions = append([]rule.Suggestion(nil), suggestions...)
}

var (
	_ rule.Reporter           = (*anchorSuggestionCapture)(nil)
	_ rule.SuggestionReporter = (*anchorSuggestionCapture)(nil)
)

// Verifies that a dangling document anchor offers only plausible, nearest
// replacements over the anchor token.
//
// Suggestions are chosen by the author, but an irrelevant choice still teaches
// the wrong repair. The near, distant, and tied cases jointly pin the boundary:
// a transposed typo gets its intended anchor, an unrelated word gets no action,
// and equally near candidates remain a choice instead of being imposed.
//
//  1. Report a transposed typo and assert the nearest anchor replaces only its
//     anchor token.
//  2. Report an unrelated anchor and assert the diagnostic degrades without a
//     suggestion.
//  3. Report one-letter ambiguities and assert deterministic ordering with an
//     explicit anchor first when distances tie.
//  4. Remove the proven target range and assert the diagnostic remains but no
//     speculative edit is attached.
func TestReferenceSuggestsNearestAnchor(t *testing.T) {
	t.Run("transposed typo", func(t *testing.T) {
		capture := &anchorSuggestionCapture{}
		ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, capture)
		index := evidenceIndexWithAnchors("pricing", "refund-policy", "shipping")
		tag := danglingDocumentTag("prciing", 40)

		checkDocumentReference(ctx, index, tag)

		if capture.suggestionReports != 1 || capture.rangeReports != 0 {
			t.Fatalf(
				"report counts = suggestion %d, plain %d; want 1, 0",
				capture.suggestionReports,
				capture.rangeReports,
			)
		}
		if len(capture.suggestions) != 1 {
			t.Fatalf("suggestions = %+v, want exactly the nearest anchor", capture.suggestions)
		}
		suggestion := capture.suggestions[0]
		if suggestion.Title != "Change anchor to '#pricing'" {
			t.Errorf("suggestion title = %q", suggestion.Title)
		}
		if len(suggestion.Edits) != 1 {
			t.Fatalf("suggestion edits = %+v, want one replacement", suggestion.Edits)
		}
		edit := suggestion.Edits[0]
		wantPos := tag.TargetEnd - len(tag.Anchor)
		if edit.Pos != wantPos || edit.End != tag.TargetEnd || edit.Text != "pricing" {
			t.Errorf(
				"suggestion edit = %+v, want {%d %d %q}",
				edit,
				wantPos,
				tag.TargetEnd,
				"pricing",
			)
		}
		if capture.pos != tag.TargetPos || capture.end != tag.TargetEnd {
			t.Errorf(
				"diagnostic range = %d..%d, want %d..%d",
				capture.pos,
				capture.end,
				tag.TargetPos,
				tag.TargetEnd,
			)
		}
		if !strings.Contains(capture.message, tag.Target) {
			t.Errorf("diagnostic does not name %q: %s", tag.Target, capture.message)
		}
	})

	t.Run("unrelated anchor", func(t *testing.T) {
		capture := &anchorSuggestionCapture{}
		ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, capture)

		checkDocumentReference(
			ctx,
			evidenceIndexWithAnchors("pricing"),
			danglingDocumentTag("discounts", 10),
		)

		if capture.rangeReports != 1 || capture.suggestionReports != 0 {
			t.Errorf(
				"report counts = suggestion %d, plain %d; want 0, 1",
				capture.suggestionReports,
				capture.rangeReports,
			)
		}
	})

	t.Run("equally near anchors", func(t *testing.T) {
		capture := &anchorSuggestionCapture{}
		ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, capture)

		checkDocumentReference(
			ctx,
			evidenceIndexWithAnchors("cut", "cat", "completely-different"),
			danglingDocumentTag("cot", 20),
		)

		if len(capture.suggestions) != 2 {
			t.Fatalf("suggestions = %+v, want the two nearest anchors", capture.suggestions)
		}
		titles := []string{
			capture.suggestions[0].Title,
			capture.suggestions[1].Title,
		}
		if titles[0] != "Change anchor to '#cat'" ||
			titles[1] != "Change anchor to '#cut'" {
			t.Errorf("suggestion titles = %v, want cat then cut", titles)
		}
	})

	t.Run("explicit anchor wins a distance tie", func(t *testing.T) {
		capture := &anchorSuggestionCapture{}
		ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, capture)
		index := &evidenceIndex{
			Documents: map[string][]documentSection{
				"docs/spec.md": {
					{Anchor: "cat"},
					{Anchor: "cut", Explicit: true},
				},
			},
		}

		checkDocumentReference(
			ctx,
			index,
			danglingDocumentTag("cot", 20),
		)

		if len(capture.suggestions) != 2 {
			t.Fatalf("suggestions = %+v, want both nearest anchors", capture.suggestions)
		}
		if capture.suggestions[0].Title != "Change anchor to '#cut'" ||
			capture.suggestions[1].Title != "Change anchor to '#cat'" {
			t.Errorf(
				"suggestion titles = [%s, %s], want explicit cut before derived cat",
				capture.suggestions[0].Title,
				capture.suggestions[1].Title,
			)
		}
	})

	t.Run("unknown target range", func(t *testing.T) {
		capture := &anchorSuggestionCapture{}
		ctx := rule.NewContext(nil, nil, rule.SeverityError, nil, capture)
		tag := danglingDocumentTag("prciing", 40)
		tag.TargetPos = 0
		tag.TargetEnd = 0

		checkDocumentReference(
			ctx,
			evidenceIndexWithAnchors("pricing"),
			tag,
		)

		if capture.rangeReports != 1 || capture.suggestionReports != 0 {
			t.Errorf(
				"report counts = suggestion %d, plain %d; want 0, 1",
				capture.suggestionReports,
				capture.rangeReports,
			)
		}
	})
}

func evidenceIndexWithAnchors(anchors ...string) *evidenceIndex {
	sections := make([]documentSection, 0, len(anchors))
	for _, anchor := range anchors {
		sections = append(sections, documentSection{Anchor: anchor})
	}
	return &evidenceIndex{
		Documents: map[string][]documentSection{"docs/spec.md": sections},
	}
}

func danglingDocumentTag(anchor string, targetPos int) evidenceTag {
	target := "docs/spec.md#" + anchor
	return evidenceTag{
		Target:    target,
		Kind:      referenceKindDocument,
		Path:      "docs/spec.md",
		Anchor:    anchor,
		TargetPos: targetPos,
		TargetEnd: targetPos + len(target),
	}
}
