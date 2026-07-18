package evidence

import (
	"testing"

	"github.com/samchon/ttsc/packages/lint/rule"
)

// fakeProjectResults feeds residentIndex a crafted project-rule snapshot.
type fakeProjectResults struct{ result rule.ProjectRuleResult }

func (f fakeProjectResults) ProjectResult(string) rule.ProjectRuleResult { return f.result }

// TestResidentIndexSurvivesFailedPublish pins that a still-published index stays
// usable after the index rule marks itself failed.
//
// reportAmbiguousAnchors calls ctx.Report for one duplicate heading slug, which
// flips evidence/index to ProjectRuleFailed even though it goes on to publish a
// complete index through ctx.SetState. Keying residentIndex on ProjectRulePassed
// therefore let a single duplicate heading anywhere discard the whole index and
// silence evidence/reference and evidence/require across the entire project,
// including citations with nothing to do with the clash. The gate is a usable
// index, not a passing status; the ambiguity is still surfaced by the index
// rule's own diagnostic.
//
//  1. Failed status but a valid published index → residentIndex resolves it.
//  2. Failed status with no published state → residentIndex refuses, because
//     there is genuinely nothing to resolve against.
func TestResidentIndexSurvivesFailedPublish(t *testing.T) {
	index := &evidenceIndex{
		Documents: map[string][]documentSection{
			"docs/spec.md": {{Anchor: "overview"}},
		},
	}
	failedButPublished := fakeProjectResults{
		result: rule.NewProjectRuleResult(rule.ProjectRuleFailed, index, nil, nil),
	}
	ctx := rule.NewContextWithProjectResults(nil, nil, rule.SeverityError, nil, nil, failedButPublished)
	got, ok := residentIndex(ctx)
	if !ok {
		t.Fatal("a failed index that still published its state must remain usable")
	}
	if got != index {
		t.Fatalf("residentIndex returned the wrong index: %+v", got)
	}

	failedNoState := fakeProjectResults{
		result: rule.NewProjectRuleResult(rule.ProjectRuleFailed, nil, nil, nil),
	}
	ctx = rule.NewContextWithProjectResults(nil, nil, rule.SeverityError, nil, nil, failedNoState)
	if _, ok := residentIndex(ctx); ok {
		t.Fatal("a failed index with no published state must not resolve")
	}
}
