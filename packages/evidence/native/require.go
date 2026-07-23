package evidence

import (
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"

	"github.com/samchon/ttsc/packages/lint/rule"
)

// requireRule enforces citation obligations: declarations in configured folders
// must cite a document section under configured folders.
//
// This is the source-side question, and it is a third question rather than a
// variant of the other two. `evidence-graph/reference` asks whether a citation points
// at something real (integrity, every edge). A coverage rule would ask which
// declared section nothing has proven (target-side, realization edges). This
// asks which declaration asserts something while citing nothing at all. The
// prior art keeps the three apart deliberately — autobe-mcp implements this one
// in its write-time validator, not in its coverage rule — and collapsing them
// produces a ledger that answers none of the three questions honestly.
type requireRule struct{}

func (requireRule) Name() string { return "evidence-graph/require" }

// Visits registers only KindSourceFile, and the rule walks top-level statements
// itself.
//
// Registering KindInterfaceDeclaration and friends would enroll this rule in
// the engine's recursive walk, dispatching it for every interface nested inside
// every function body — declarations an obligation has no business demanding
// citations from. An exported declaration is top-level by definition, so the
// manual walk is both cheaper and more correct.
func (requireRule) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindSourceFile}
}

func (requireRule) AcceptsTtscLintOptions() bool { return true }

// NeedsTypeChecker is false because an obligation is answered from syntax
// alone: does this declaration carry a tag citing a matching document?
//
// Note this currently buys nothing — a declared project rule flips the engine's
// single global needsTypeChecker flag, and `evidence-graph/index` is always declared.
// It stays because it is true, costs nothing, and becomes correct the day
// upstream lets a project rule decline the checker.
func (requireRule) NeedsTypeChecker() bool { return false }

// VisitsDeclarationFiles is false because a `.d.ts` is generated output. An
// obligation is a demand on an author, and nobody authors a declaration file.
func (requireRule) VisitsDeclarationFiles() bool { return false }

type requireOptions struct {
	Policies []requirePolicy `json:"policies"`
}

// requirePolicy reads: declarations in Files must cite a section under Targets.
type requirePolicy struct {
	Files   []string `json:"files"`
	Targets []string `json:"targets"`
	Kinds   []string `json:"kinds"`
	Message string   `json:"message"`
}

func (requireRule) Check(ctx *rule.Context, _ *shimast.Node) {
	if ctx == nil || ctx.File == nil {
		return
	}
	index, ok := residentIndex(ctx)
	if !ok {
		// The activation gate. With no index, no citation could resolve, so
		// every declaration would look ungrounded and the author would be
		// pushed to invent citations to silence a rule that is merely blind.
		return
	}
	path, inside := index.relativePath(ctx.File.FileName())
	if !inside {
		return
	}

	var options requireOptions
	_ = ctx.DecodeOptions(&options)

	for _, policy := range options.Policies {
		// An empty file set matches nothing, never everything. A policy whose
		// globs went missing — a `json:` tag typo yields exactly this zero
		// value with no error — must go quiet rather than silently place the
		// whole repository under obligation.
		if len(policy.Files) == 0 || len(policy.Targets) == 0 {
			continue
		}
		if !matchAnyGlob(policy.Files, path) {
			continue
		}
		for _, obliged := range obligedDeclarations(ctx.File, policy) {
			checkObligation(ctx, obliged, policy)
		}
	}
}

// obligedDeclaration separates where the citation lives from what the
// diagnostic points at.
//
// They are not always the same node. A `export const RATE = 1` carries its
// JSDoc on the VariableStatement while the name lives on the VariableDeclaration
// inside it, so reading tags from the named node finds nothing and the rule
// reports every documented constant as ungrounded.
type obligedDeclaration struct {
	// TagHost owns the JSDoc block.
	TagHost *shimast.Node
	// Name is what the diagnostic underlines.
	Name *shimast.Node
}

func checkObligation(
	ctx *rule.Context,
	obliged obligedDeclaration,
	policy requirePolicy,
) {
	name := obliged.Name
	if name == nil {
		return
	}
	tags := evidenceTagsOf(ctx.File, obliged.TagHost)
	for _, tag := range tags {
		if tag.Kind != referenceKindDocument || tag.Anchor == "" {
			// Only a section discharges an obligation. A symbol citation is
			// checked for integrity by evidence-graph/reference, but it cannot ground
			// a declaration: a symbol both cites and is cited, so two
			// declarations naming each other would satisfy every obligation
			// between them while proving nothing. A section is terminal, which
			// is what makes it grounds.
			continue
		}
		if matchAnyGlob(policy.Targets, normalizePath(tag.Path)) {
			return
		}
	}
	ctx.Report(name, obligationMessage(shimast.NodeText(name), tags, policy))
}

// obligationMessage distinguishes "cited nothing" from "cited the wrong place".
//
// The two mistakes have different repairs and the same symptom, so one message
// covering both would send half its readers the wrong way.
func obligationMessage(
	name string,
	tags []evidenceTag,
	policy requirePolicy,
) string {
	if policy.Message != "" {
		return policy.Message
	}
	targets := strings.Join(policy.Targets, ", ")
	if len(tags) == 0 {
		return "'" + name + "' is not grounded. Declarations under " +
			strings.Join(policy.Files, ", ") + " must cite a section under " +
			targets + ", as in '@evidence docs/spec.md#pricing <why this " +
			"declaration follows from that section>'."
	}
	return "'" + name + "' cites " + describeTargets(tags) +
		", and none of them is a section under " + targets +
		". A citation outside the required documents does not discharge this " +
		"obligation, even when it resolves."
}

func describeTargets(tags []evidenceTag) string {
	quoted := make([]string, 0, len(tags))
	for _, tag := range tags {
		quoted = append(quoted, "'"+tag.Target+"'")
	}
	return strings.Join(quoted, ", ")
}

// defaultObligedKinds are the declarations that carry a design decision.
//
// Variables and namespaces are excluded by default and opt-in through `kinds`:
// most are plumbing, and a rule that demands grounds for every exported const
// trains authors to write filler citations, which is worse than demanding
// nothing.
var defaultObligedKinds = map[shimast.Kind]bool{
	shimast.KindInterfaceDeclaration: true,
	shimast.KindTypeAliasDeclaration: true,
	shimast.KindClassDeclaration:     true,
	shimast.KindFunctionDeclaration:  true,
	shimast.KindEnumDeclaration:      true,
}

var obligedKindsByName = map[string]shimast.Kind{
	"interface": shimast.KindInterfaceDeclaration,
	"type":      shimast.KindTypeAliasDeclaration,
	"class":     shimast.KindClassDeclaration,
	"function":  shimast.KindFunctionDeclaration,
	"enum":      shimast.KindEnumDeclaration,
	"variable":  shimast.KindVariableStatement,
	"namespace": shimast.KindModuleDeclaration,
}

// obligedDeclarations returns the exported top-level declarations a policy
// governs.
//
// Only exported declarations are obliged. A module-private declaration is an
// implementation detail of something already under obligation; demanding
// separate grounds for it multiplies citations without multiplying proof.
func obligedDeclarations(
	file *shimast.SourceFile,
	policy requirePolicy,
) []obligedDeclaration {
	kinds := resolveObligedKinds(policy)
	obliged := []obligedDeclaration{}
	if file.Statements == nil {
		return obliged
	}
	for _, statement := range file.Statements.Nodes {
		if statement == nil || !kinds[statement.Kind] {
			continue
		}
		if !hasExportModifier(statement) {
			continue
		}
		if statement.Kind == shimast.KindVariableStatement {
			// The statement owns the JSDoc; each declaration owns a name.
			for _, declaration := range variableDeclarationsOf(statement) {
				obliged = append(obliged, obligedDeclaration{
					TagHost: statement,
					Name:    declaration.Name(),
				})
			}
			continue
		}
		obliged = append(obliged, obligedDeclaration{
			TagHost: statement,
			Name:    statement.Name(),
		})
	}
	return obliged
}

func resolveObligedKinds(policy requirePolicy) map[shimast.Kind]bool {
	if len(policy.Kinds) == 0 {
		return defaultObligedKinds
	}
	kinds := map[shimast.Kind]bool{}
	for _, name := range policy.Kinds {
		if kind, ok := obligedKindsByName[strings.ToLower(name)]; ok {
			kinds[kind] = true
		}
	}
	return kinds
}

func variableDeclarationsOf(statement *shimast.Node) []*shimast.Node {
	found := []*shimast.Node{}
	variables := statement.AsVariableStatement()
	if variables == nil || variables.DeclarationList == nil {
		return found
	}
	list := variables.DeclarationList.AsVariableDeclarationList()
	if list == nil || list.Declarations == nil {
		return found
	}
	for _, declaration := range list.Declarations.Nodes {
		if declaration != nil && declaration.Name() != nil {
			found = append(found, declaration)
		}
	}
	return found
}

func hasExportModifier(node *shimast.Node) bool {
	modifiers := node.Modifiers()
	if modifiers == nil {
		return false
	}
	for _, modifier := range modifiers.Nodes {
		if modifier != nil && modifier.Kind == shimast.KindExportKeyword {
			return true
		}
	}
	return false
}
