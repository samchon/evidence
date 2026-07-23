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
// The gate is a usable index, not the index rule's pass/fail status. The index
// rule reports an ambiguous anchor through ctx.Report, which marks it Failed
// while it still publishes a complete index through ctx.SetState — so keying on
// ProjectRulePassed would let one duplicate heading anywhere discard the whole
// index and silence evidence/reference and evidence/require across the entire
// project, even for citations that have nothing to do with the clash. A result
// whose State is a valid *evidenceIndex is usable regardless of status; the
// ambiguity is still surfaced by the index rule's own diagnostic. `off`,
// `absent`, and `not_evaluated` all leave State nil, which is the real "no
// identity source, nothing to say" signal a file rule stays silent for.
func residentIndex(ctx *rule.Context) (*evidenceIndex, bool) {
	result := ctx.ProjectResult(indexRuleName)
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
	targetPos, targetEnd := tag.targetRange()
	if path == "" {
		// `#anchor` alone: a document reference with no document. Resolving it
		// against the citing file would be meaningless — the citing file is
		// TypeScript, and it has no sections.
		ctx.ReportRange(
			targetPos,
			targetEnd,
			"Evidence target '"+tag.Target+"' names an anchor with no document. "+
				"Write the document path too, as in 'docs/spec.md"+tag.Target+"'.",
		)
		return
	}
	sections, known := index.anchors(path)
	if !known {
		ctx.ReportRange(
			targetPos,
			targetEnd,
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
			targetPos,
			targetEnd,
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
	message := "Evidence target '" + tag.Target + "' refers to a section that " +
		path + " does not declare." + suggestAnchors(sections) +
		" An anchor is derived from the heading text unless the heading " +
		"declares one explicitly with '{#id}'."
	ctx.ReportRangeSuggestion(
		targetPos,
		targetEnd,
		message,
		nearestAnchorSuggestions(tag, sections)...,
	)
}

func checkSymbolReference(ctx *rule.Context, index *evidenceIndex, tag evidenceTag) {
	if index.hasSymbol(tag.Target) {
		return
	}
	targetPos, targetEnd := tag.targetRange()
	ctx.ReportRange(
		targetPos,
		targetEnd,
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

// nearestAnchorSuggestions turns a plausible anchor typo into editor choices.
//
// The diagnostic remains complete without them: Context degrades to a plain
// report when its host has no SuggestionReporter or when this function returns
// none. Suggestions are deliberately bounded and opt-in. An unrelated anchor
// must not acquire a one-click rewrite merely because every finite set has a
// mathematically nearest member.
func nearestAnchorSuggestions(
	tag evidenceTag,
	sections []documentSection,
) []rule.Suggestion {
	if tag.Anchor == "" ||
		tag.TargetEnd <= tag.TargetPos ||
		tag.TargetEnd-tag.TargetPos != len(tag.Target) {
		// locateTarget could not prove the token's exact source range. The
		// diagnostic may safely fall back to the whole tag, but an edit may
		// not: replacing an inferred range risks eating the reason beside it.
		return nil
	}

	type candidate struct {
		anchor   string
		distance int
		explicit bool
	}
	source := []rune(strings.ToLower(tag.Anchor))
	ranked := []candidate{}
	seen := map[string]bool{}
	for _, section := range sections {
		if section.Anchor == "" || seen[section.Anchor] {
			continue
		}
		seen[section.Anchor] = true

		target := []rune(strings.ToLower(section.Anchor))
		limit := anchorDistanceLimit(len(source), len(target))
		distance := boundedAnchorDistance(source, target, limit)
		if distance > limit {
			continue
		}
		ranked = append(ranked, candidate{
			anchor:   section.Anchor,
			distance: distance,
			explicit: section.Explicit,
		})
	}
	sort.Slice(ranked, func(a, b int) bool {
		if ranked[a].distance != ranked[b].distance {
			return ranked[a].distance < ranked[b].distance
		}
		if ranked[a].explicit != ranked[b].explicit {
			// When two repairs are equally plausible, teach the stable identity
			// before one derived from mutable heading text.
			return ranked[a].explicit
		}
		return ranked[a].anchor < ranked[b].anchor
	})
	if len(ranked) > 3 {
		ranked = ranked[:3]
	}

	anchorPos := tag.TargetEnd - len(tag.Anchor)
	suggestions := make([]rule.Suggestion, 0, len(ranked))
	for _, candidate := range ranked {
		suggestions = append(suggestions, rule.Suggestion{
			Title: "Change anchor to '#" + candidate.anchor + "'",
			Edits: []rule.TextEdit{{
				Pos:  anchorPos,
				End:  tag.TargetEnd,
				Text: candidate.anchor,
			}},
		})
	}
	return suggestions
}

// anchorDistanceLimit admits roughly one edit per four runes, up to four.
//
// The cap keeps a long, unrelated heading from becoming a candidate merely
// because both strings are long. A one-rune allowance still repairs short
// anchors, where one typo is necessarily a large fraction of the word.
func anchorDistanceLimit(left int, right int) int {
	longer := left
	if right > longer {
		longer = right
	}
	limit := (longer + 3) / 4
	if limit < 1 {
		return 1
	}
	if limit > 4 {
		return 4
	}
	return limit
}

// boundedAnchorDistance is an optimal-string-alignment distance with an
// adjacent-transposition edit, evaluated only inside the caller's narrow band.
//
// Anchor text is untrusted markdown. A full n×m matrix lets one enormous
// heading turn a diagnostic into quadratic memory and work; the band makes the
// cost O(limit × max(n, m)) while preserving every result within the threshold.
func boundedAnchorDistance(left []rune, right []rune, limit int) int {
	if anchorLengthDifference(len(left), len(right)) > limit {
		return limit + 1
	}

	unreachable := limit + 1
	previousPrevious := make([]int, len(right)+1)
	previous := make([]int, len(right)+1)
	current := make([]int, len(right)+1)
	for index := range previousPrevious {
		previousPrevious[index] = unreachable
		previous[index] = unreachable
		current[index] = unreachable
	}
	for column := 0; column <= len(right) && column <= limit; column++ {
		previous[column] = column
	}

	for row := 1; row <= len(left); row++ {
		first := row - limit
		if first < 1 {
			first = 1
		}
		last := row + limit
		if last > len(right) {
			last = len(right)
		}
		if first > 1 {
			// This row slice was used three iterations ago. Invalidate the
			// cell immediately before the new band so insertion cannot walk
			// in from a stale value.
			current[first-1] = unreachable
		}
		if row <= limit {
			current[0] = row
		} else {
			current[0] = unreachable
		}
		for column := first; column <= last; column++ {
			substitutionCost := 1
			if left[row-1] == right[column-1] {
				substitutionCost = 0
			}
			value := minimumAnchorCost(
				previous[column]+1,
				current[column-1]+1,
				previous[column-1]+substitutionCost,
			)
			if row > 1 &&
				column > 1 &&
				left[row-1] == right[column-2] &&
				left[row-2] == right[column-1] {
				transposed := previousPrevious[column-2] + 1
				if transposed < value {
					value = transposed
				}
			}
			if value > unreachable {
				value = unreachable
			}
			current[column] = value
		}
		if last < len(right) {
			// The next row may read one cell beyond this row's upper band as a
			// deletion predecessor.
			current[last+1] = unreachable
		}
		previousPrevious, previous, current = previous, current, previousPrevious
	}
	return previous[len(right)]
}

func anchorLengthDifference(left int, right int) int {
	if left > right {
		return left - right
	}
	return right - left
}

func minimumAnchorCost(first int, second int, third int) int {
	if second < first {
		first = second
	}
	if third < first {
		return third
	}
	return first
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
	if ok {
		tag.TargetPos, tag.TargetEnd = locateTarget(file, pos, end, tag.Target)
	}
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

// locateTarget finds the target token's span inside a tag's source range.
//
// The parser hands back the target's text but not where it sits, and a tag node
// spans `@evidence <target> <reason>` entire — so the offset has to be
// recovered from the source. The search starts past the tag name rather than at
// the range's start: a target may legitimately BE the tag name
// (`@evidence evidence`), and searching from zero would underline the tag name
// while claiming to point at the target.
func locateTarget(
	file *shimast.SourceFile,
	pos int,
	end int,
	target string,
) (int, int) {
	if target == "" || file == nil {
		return 0, 0
	}
	text := file.Text()
	if pos < 0 || end > len(text) || pos >= end {
		return 0, 0
	}
	span := text[pos:end]
	offset := 0
	if index := strings.Index(span, "@"+evidenceTagName); index != -1 {
		offset = index + len("@") + len(evidenceTagName)
	}
	if offset >= len(span) {
		return 0, 0
	}
	at := strings.Index(span[offset:], target)
	if at == -1 {
		return 0, 0
	}
	start := pos + offset + at
	return start, start + len(target)
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
