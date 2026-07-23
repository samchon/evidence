package evidence

import (
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"

	"github.com/samchon/ttsc/packages/lint/rule"
)

// coverageRuleName is this rule's registered name.
const coverageRuleName = "evidence-graph/coverage"

// coverageRule reports declared sections that nothing cites.
//
// This is the target-side question, the third of three. `evidence-graph/reference`
// asks whether a citation points at something real; `evidence-graph/require` asks
// whether a declaration asserts something while citing nothing; this asks which
// section of the design nothing in the code claims to implement.
//
// Its blindness is structural and worth naming: it counts sections with no
// citation and therefore can never see a citation with no section. That is
// `evidence-graph/reference`'s job, and the two must not be merged — their scopes
// differ on purpose, and a single rule doing both would answer neither
// question honestly.
//
// It is a project rule for a reason that also solves a problem the prior art
// worked around. A finding here is about a markdown section, which has no
// TypeScript node to hang a diagnostic on; `autobe-mcp` had to nominate an
// arbitrary anchor file (`src/MyModule.ts`) purely so a file rule would have
// somewhere to report. Project findings carry no file and no range, which is
// exactly the right shape for "nothing cites this section" — so no anchor is
// needed, and none is configurable.
type coverageRule struct{}

func (coverageRule) Name() string { return coverageRuleName }

// NeedsTypeChecker is false for the same reason as the index rule: coverage
// compares markdown read from disk against tags read from the AST, and never
// touches ctx.Checker. See index.go for why the marker is declared despite
// having no effect on the currently published host.
func (coverageRule) NeedsTypeChecker() bool { return false }

type coverageOptions struct {
	// Documents whose sections must be cited. Required because project rules
	// cannot inherit one another's options.
	Documents []string `json:"documents"`
}

func (coverageRule) Check(ctx *rule.ProjectContext) {
	if ctx == nil {
		return
	}
	root := projectRoot(ctx.Identity)
	if root == "" {
		return
	}

	var options coverageOptions
	_ = ctx.DecodeOptions(&options)
	if len(options.Documents) == 0 {
		ctx.Report(
			"evidence-graph/coverage requires a non-empty 'documents' option, for " +
				"example [\"docs/**/*.md\"]. Coverage cannot inherit " +
				"evidence-graph/index's scope, and guessing every markdown file could " +
				"demand citations for unrelated documentation.",
		)
		return
	}

	index := buildEvidenceIndex(root, options.Documents, ctx.Sources)
	cited := citedAnchors(ctx.Sources)
	uncovered := []string{}
	for _, path := range index.documentPaths() {
		for _, section := range index.Documents[path] {
			if section.ExemptionBlank {
				ctx.Report(
					"Section '" + path + "#" + section.Anchor + "' carries an " +
						"exemption with no reason. State why this section needs no " +
						"citation, as in '<!-- evidence-exempt: describes a " +
						"convention, not behavior -->'. A blank reason is not a " +
						"reason.",
				)
				continue
			}
			if section.Exempt() {
				continue
			}
			if cited[path+"#"+section.Anchor] {
				continue
			}
			uncovered = append(uncovered, path+"#"+section.Anchor)
		}
	}
	if len(uncovered) == 0 {
		return
	}
	sort.Strings(uncovered)
	ctx.Report(
		"Nothing cites " + countedSections(len(uncovered)) + ": " +
			strings.Join(uncovered, ", ") + ". Either cite each from the " +
			"declaration it grounds with '@evidence <section> <reason>', or " +
			"state why it needs none by putting '<!-- evidence-exempt: " +
			"<reason> -->' under its heading.",
	)
}

func countedSections(count int) string {
	if count == 1 {
		return "1 declared section"
	}
	return itoa(count) + " declared sections"
}

// citedAnchors collects every `<path>#<anchor>` any source cites.
//
// Every citation counts, wherever it lives. The prior art splits its edges into
// intent and realization so that a promise to build something cannot discharge
// the obligation to have built it, and that distinction is real — but it is a
// property of the artifact kind, which this plugin does not model. Inventing a
// split the tag grammar cannot express would produce a ledger whose numbers
// nobody could explain. See `.wiki/design/decisions.md`.
func citedAnchors(sources []*shimast.SourceFile) map[string]bool {
	cited := map[string]bool{}
	for _, file := range sources {
		if file == nil {
			continue
		}
		for _, tag := range collectEvidenceTags(file) {
			if tag.Kind != referenceKindDocument || tag.Anchor == "" {
				continue
			}
			cited[normalizePath(tag.Path)+"#"+tag.Anchor] = true
		}
	}
	return cited
}
