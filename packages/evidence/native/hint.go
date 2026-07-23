package evidence

import (
	"sort"

	"github.com/samchon/ttsc/packages/lint/rule"
)

// indexRule must satisfy HintRule. The marker is an optional interface, so a
// signature that drifts out of shape does not fail the build — the host simply
// stops asking, and a rule that is never asked looks exactly like a rule with
// nothing to say. This assertion turns that silence into a compile error.
var _ rule.HintRule = indexRule{}

// Hints publishes the completion corpus for `@evidence` targets.
//
// The rule value is stateless — `rule.RegisterProject(indexRule{})` registers a
// value with no fields — so the index arrives back through ctx.State, exactly as
// a file rule reads it through ProjectResult. The host asks only after Check
// passed and published, so a failed assertion here means this rule published
// something other than what it believes.
func (indexRule) Hints(ctx *rule.HintContext) []rule.Hint {
	index, ok := ctx.State.(*evidenceIndex)
	if !ok || index == nil {
		return nil
	}

	// `@evi` -> `@evidence`.
	//
	// Label is left empty, so it is `evidence` rather than `@evidence`: the user
	// already typed the `@`, that is the trigger, and the editor filters on what
	// follows it. A Label carrying the `@` would fail to prefix-match `evi` and
	// the entry would vanish exactly when it is wanted.
	hints := []rule.Hint{{
		Insert: evidenceTagName,
		Detail: "cite the grounds for this declaration",
		Trigger: rule.HintTrigger{
			Scope: rule.HintScopeJSDoc,
			After: "@",
		},
	}}

	for _, path := range index.documentPaths() {
		sections := index.Documents[path]

		// `@evidence docs/sp` -> `docs/spec.md`.
		hints = append(hints, rule.Hint{
			Insert: path,
			Detail: itoa(len(sections)) + " sections",
			Trigger: rule.HintTrigger{
				Scope: rule.HintScopeJSDoc,
				After: "@" + evidenceTagName + " ",
			},
		})

		// `@evidence docs/spec.md#pri` -> `pricing`.
		//
		// Anchors are published per document because the trigger that reaches
		// them NAMES the document: the corpus behind `docs/spec.md#` is that
		// file's sections and nothing else. That is why a literal trigger
		// suffices where a pattern looked necessary — the index already knows
		// every path, so it can afford to spell each one out.
		anchorTrigger := rule.HintTrigger{
			Scope: rule.HintScopeJSDoc,
			After: "@" + evidenceTagName + " " + path + "#",
		}
		for _, section := range rankedSections(sections) {
			hints = append(hints, rule.Hint{
				Insert:  section.Anchor,
				Detail:  section.Title,
				Trigger: anchorTrigger,
			})
		}
	}
	return hints
}

// rankedSections offers explicit anchors before derived ones.
//
// Slice order is the ranking, and an explicit `{#id}` is the anchor worth
// citing: it survives an edit to the heading text, while a derived one breaks
// the moment somebody fixes a typo in the prose. Offering the fragile one first
// would teach authors to pick it, and `evidence-graph/reference` would then blame them
// for taking what the editor handed over.
func rankedSections(sections []documentSection) []documentSection {
	ranked := append([]documentSection(nil), sections...)
	sort.SliceStable(ranked, func(a, b int) bool {
		return ranked[a].Explicit && !ranked[b].Explicit
	})
	return ranked
}
