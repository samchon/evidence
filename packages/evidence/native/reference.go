package evidence

import (
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"

	"github.com/samchon/ttsc/packages/lint/rule"
)

// referenceRule validates every `@evidence` tag in a file: the target must
// resolve, and the citation must carry a reason.
//
// This is the integrity half of the graph, and its scope is deliberately wider
// than coverage's. Coverage asks "which sections has nothing proven"; it counts
// only sections with no citation and therefore can never see a citation with no
// section. Without this rule, a document renamed or a heading re-anchored
// strands every citation pointing at it, and nothing says so.
type referenceRule struct{}

func (referenceRule) Name() string { return "evidence/reference" }

func (referenceRule) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindSourceFile}
}

// NeedsTypeChecker is false because this rule resolves against the index built
// by the project rule, not the checker. Saying otherwise would make the host
// build a checker over every file and walk files serially — the API's default,
// and the expensive one.
func (referenceRule) NeedsTypeChecker() bool { return false }

// VisitsDeclarationFiles is false because a `.d.ts` carries no authored
// provenance; it is generated output, and reporting there would blame an author
// for a file they do not write.
func (referenceRule) VisitsDeclarationFiles() bool { return false }

func (referenceRule) Check(ctx *rule.Context, _ *shimast.Node) {
	if ctx == nil || ctx.File == nil {
		return
	}
	index, ok := residentIndex(ctx)
	if !ok {
		// The activation gate. Without an index nothing can be resolved, so
		// every reference would look dangling and the author would be pushed to
		// delete honest citations or invent targets to silence a rule that is
		// simply not ready. Silence is the only correct behavior here.
		return
	}
	for _, tag := range collectEvidenceTags(ctx.File) {
		checkEvidenceTag(ctx, index, tag)
	}
}

// residentIndex reads the project rule's published index.
//
// It returns false unless the index rule actually evaluated and passed. `off`,
// `absent`, and `not_evaluated` all mean the same thing to a file rule: there
// is no identity source, so there is nothing to say.
func residentIndex(ctx *rule.Context) (*evidenceIndex, bool) {
	result := ctx.ProjectResult(indexRuleName)
	if result.Status != rule.ProjectRulePassed {
		return nil, false
	}
	index, ok := result.State.(*evidenceIndex)
	if !ok || index == nil {
		return nil, false
	}
	return index, true
}

func checkEvidenceTag(ctx *rule.Context, index *evidenceIndex, tag evidenceTag) {
	if tag.Target == "" {
		ctx.ReportRange(
			tag.Pos,
			tag.End,
			"An @evidence tag needs a target: write '@evidence <target> <reason>', "+
				"where <target> is a document section such as 'docs/spec.md#pricing' "+
				"or a TypeScript symbol such as 'IShoppingSale.IUpdate'.",
		)
		return
	}
	if tag.Reason == "" {
		ctx.ReportRange(
			tag.Pos,
			tag.End,
			"Evidence for '"+tag.Target+"' states no reason. Write why this "+
				"declaration is grounded in that "+tag.Kind.String()+
				", as in '@evidence "+tag.Target+" <reason>'. A bare pointer cannot "+
				"be reviewed, because nothing in it says what the citation claims.",
		)
		return
	}
	switch tag.Kind {
	case referenceKindDocument:
		checkDocumentReference(ctx, index, tag)
	case referenceKindSymbol:
		checkSymbolReference(ctx, index, tag)
	}
}

func checkDocumentReference(ctx *rule.Context, index *evidenceIndex, tag evidenceTag) {
	path := normalizePath(tag.Path)
	if path == "" {
		// `#anchor` alone: a document reference with no document. Resolving it
		// against the citing file would be meaningless — the citing file is
		// TypeScript, and it has no sections.
		ctx.ReportRange(
			tag.Pos,
			tag.End,
			"Evidence target '"+tag.Target+"' names an anchor with no document. "+
				"Write the document path too, as in 'docs/spec.md"+tag.Target+"'.",
		)
		return
	}
	sections, known := index.anchors(path)
	if !known {
		ctx.ReportRange(
			tag.Pos,
			tag.End,
			"Evidence target '"+tag.Target+"' refers to "+path+
				", which the evidence index does not contain. "+
				describeIndexScope(index)+" Check the path, or widen the "+
				"'documents' option of the '"+indexRuleName+"' rule to cover it.",
		)
		return
	}
	if tag.Anchor == "" {
		// A whole-document citation is refused on purpose. "The grounds are
		// somewhere in this file" is not grounds: a reviewer cannot check it,
		// and it silently survives every edit to the document — including the
		// edit that deletes the paragraph it meant. A section is the smallest
		// unit that stays honest.
		ctx.ReportRange(
			tag.Pos,
			tag.End,
			"Evidence target '"+tag.Target+"' cites a whole document. Cite the "+
				"section that carries the grounds, as in '"+path+"#"+
				firstAnchor(sections)+"'."+suggestAnchors(sections),
		)
		return
	}
	for _, section := range sections {
		if section.Anchor == tag.Anchor {
			return
		}
	}
	ctx.ReportRange(
		tag.Pos,
		tag.End,
		"Evidence target '"+tag.Target+"' refers to a section that "+path+
			" does not declare."+suggestAnchors(sections)+
			" An anchor is derived from the heading text unless the heading "+
			"declares one explicitly with '{#id}'.",
	)
}

func checkSymbolReference(ctx *rule.Context, index *evidenceIndex, tag evidenceTag) {
	if index.hasSymbol(tag.Target) {
		return
	}
	ctx.ReportRange(
		tag.Pos,
		tag.End,
		"Evidence target '"+tag.Target+"' was read as a "+tag.Kind.String()+
			", and no such declaration exists in this project. If a document was "+
			"meant, give it a path or an anchor, as in 'docs/spec.md#"+tag.Target+"'.",
	)
}

// describeIndexScope tells the author what was actually scanned, so a
// not-indexed document is distinguishable from a misspelled one.
func describeIndexScope(index *evidenceIndex) string {
	if len(index.Documents) == 0 {
		return "The index is empty; no markdown matched " +
			strings.Join(index.DocumentPatterns, ", ") + "."
	}
	paths := index.documentPaths()
	if len(paths) > 5 {
		paths = paths[:5]
	}
	return "Indexed documents include " + strings.Join(paths, ", ") + "."
}

// firstAnchor names a concrete anchor for a suggestion, so the repair in a
// diagnostic is something the author can paste rather than a shape to fill in.
func firstAnchor(sections []documentSection) string {
	if len(sections) == 0 {
		return "<section>"
	}
	return sections[0].Anchor
}

// suggestAnchors lists what the document does declare. A "no such section"
// diagnostic that does not say what exists sends the author to open the file
// and guess; listing the anchors usually ends the search on the spot.
func suggestAnchors(sections []documentSection) string {
	if len(sections) == 0 {
		return " It declares no sections at all."
	}
	anchors := make([]string, 0, len(sections))
	for _, section := range sections {
		anchors = append(anchors, section.Anchor)
	}
	sort.Strings(anchors)
	if len(anchors) > 8 {
		anchors = append(anchors[:8], "...")
	}
	return " It declares: " + strings.Join(anchors, ", ") + "."
}

// collectEvidenceTags walks every JSDoc comment in a file and returns each
// `@evidence` tag with its source range.
//
// JSDoc hangs off declarations rather than living in the statement stream, so
// this walks the tree and asks each node for its JSDoc rather than scanning
// comment trivia. The scanner approach would find the text but lose the tag
// structure, leaving the target/reason split to a second hand-rolled parser.
func collectEvidenceTags(file *shimast.SourceFile) []evidenceTag {
	tags := []evidenceTag{}
	var visit func(node *shimast.Node) bool
	visit = func(node *shimast.Node) bool {
		if node == nil {
			return false
		}
		tags = append(tags, evidenceTagsOf(file, node)...)
		node.ForEachChild(visit)
		return false
	}
	file.AsNode().ForEachChild(visit)
	return tags
}

// evidenceTagsOf returns the tags attached to ONE node.
//
// The node scope is the point. A rule asking whether a declaration is grounded
// must read that declaration's own JSDoc; reading the file's would let a
// citation on one interface silently discharge its neighbour's obligation, and
// the neighbour would look grounded while citing nothing.
func evidenceTagsOf(file *shimast.SourceFile, node *shimast.Node) []evidenceTag {
	tags := []evidenceTag{}
	for _, doc := range node.JSDoc(file) {
		if doc == nil {
			continue
		}
		block := doc.AsJSDoc()
		if block == nil || block.Tags == nil {
			continue
		}
		for _, tag := range block.Tags.Nodes {
			parsed, ok := evidenceTagFrom(file, tag)
			if ok {
				tags = append(tags, parsed)
			}
		}
	}
	return tags
}

// evidenceTagFrom converts one JSDoc tag node into an evidenceTag.
//
// The kind check is not defensive noise: `@evidence` is not a tag TypeScript
// knows, so it always parses as JSDocUnknownTag, carrying the whole remainder
// of the line as an untyped comment — which is exactly the `@name <key> <prose>`
// shape the grammar relies on. Matching the kind first also avoids the generic
// Node.TagName accessor, whose switch has no arm for most kinds.
func evidenceTagFrom(
	file *shimast.SourceFile,
	node *shimast.Node,
) (evidenceTag, bool) {
	if file == nil || node == nil || node.Kind != shimast.KindJSDocUnknownTag {
		return evidenceTag{}, false
	}
	base := node.AsJSDocUnknownTag()
	if base == nil || base.TagName == nil {
		return evidenceTag{}, false
	}
	if shimast.NodeText(base.TagName) != evidenceTagName {
		return evidenceTag{}, false
	}
	comment := jsdocCommentText(base.Comment)
	pos, end := trimTagRange(file, node.Pos(), node.End())
	tag, ok := newEvidenceTag(comment, pos, end)
	if !ok {
		// A bare `@evidence` with nothing after it. Still worth surfacing, so
		// return it with an empty target rather than dropping it: a tag the
		// author wrote and the tool ignores is the worst outcome.
		return evidenceTag{Pos: pos, End: end}, true
	}
	return tag, true
}

// trimTagRange narrows a JSDoc tag's node range to the text the author wrote.
//
// A tag node ends where the next tag or the comment terminator begins, so its
// End sweeps up the newline, the leading `*` of the following line, and the
// closing `*/`. Reported verbatim, the squiggle runs past the tag and underlines
// `*/` on the next line, which points the reader at punctuation instead of at
// their citation.
//
// ctx.Report would skip LEADING trivia for free, but nothing trims the trailing
// end, and this rule needs a range rather than a node: the finding is about the
// tag, not about the declaration the JSDoc is attached to.
func trimTagRange(file *shimast.SourceFile, pos int, end int) (int, int) {
	text := file.Text()
	if pos < 0 || end > len(text) || pos >= end {
		return pos, end
	}
	for end > pos {
		switch text[end-1] {
		case ' ', '\t', '\r', '\n', '*':
			end--
			continue
		case '/':
			// Only a `*/` terminator, never a slash the author typed inside a
			// path such as `docs/spec.md`.
			if end-1 > pos && text[end-2] == '*' {
				end--
				continue
			}
		}
		break
	}
	return pos, end
}

func jsdocCommentText(list *shimast.NodeList) string {
	if list == nil {
		return ""
	}
	var builder strings.Builder
	for _, node := range list.Nodes {
		builder.WriteString(shimast.NodeText(node))
	}
	return builder.String()
}
