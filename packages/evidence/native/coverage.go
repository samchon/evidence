package evidence

import (
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"

	"github.com/samchon/ttsc/packages/lint/rule"
)

// coverageRuleName is this rule's registered name.
const coverageRuleName = "evidence/coverage"

// coverageRule reports declared sections that nothing cites.
//
// This is the target-side question, the third of three. `evidence/reference`
// asks whether a citation points at something real; `evidence/require` asks
// whether a declaration asserts something while citing nothing; this asks which
// section of the design nothing in the code claims to implement.
//
// Its blindness is structural and worth naming: it counts sections with no
// citation and therefore can never see a citation with no section. That is
// `evidence/reference`'s job, and the two must not be merged — their scopes
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

type coverageOptions struct {
	// Documents whose sections must be cited. Defaults to every indexed
	// document.
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

	// The index rule's own patterns are not readable from here — project rules
	// cannot read one another's state — so coverage indexes everything and
	// narrows afterwards with its own `documents`. Scanning wider than needed
	// costs file reads; scanning narrower would silently exempt whatever fell
	// outside, which is the failure worth avoiding.
	index := buildEvidenceIndex(root, defaultDocumentPatterns, ctx.Sources)
	demanded := options.Documents
	if len(demanded) == 0 {
		demanded = index.DocumentPatterns
	}

	cited := citedAnchors(ctx.Sources)
	uncovered := []string{}
	for _, path := range index.documentPaths() {
		if !matchAnyGlob(demanded, path) {
			continue
		}
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
