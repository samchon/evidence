package evidence

import (
	"strings"
)

// referenceKind is how a target was addressed. It exists so a diagnostic can
// say which kind it resolved against: the discriminator below is a heuristic,
// and a heuristic that misfires silently is worse than one that says what it
// decided.
type referenceKind int

const (
	referenceKindUnknown referenceKind = iota
	// referenceKindDocument addresses a markdown section: `docs/spec.md#pricing`.
	referenceKindDocument
	// referenceKindSymbol addresses a TypeScript declaration: `IShoppingSale.IUpdate`.
	referenceKindSymbol
)

func (kind referenceKind) String() string {
	switch kind {
	case referenceKindDocument:
		return "document section"
	case referenceKindSymbol:
		return "TypeScript symbol"
	}
	return "unknown"
}

// evidenceTag is one parsed `@evidence <target> <reason>` tag.
type evidenceTag struct {
	// Target is the first whitespace-delimited token, verbatim.
	Target string
	// Reason is everything after it, trimmed.
	Reason string
	// Kind is the discriminated addressing scheme of Target.
	Kind referenceKind
	// Path and Anchor are set only for referenceKindDocument. Anchor is empty
	// when the target names a whole document.
	Path   string
	Anchor string
	// Pos and End bound the tag's comment text in the source file, for a
	// diagnostic that underlines the tag rather than the whole declaration.
	Pos int
	End int
	// TargetPos and TargetEnd bound the target token alone.
	//
	// A diagnostic about the target should underline the target, not the whole
	// tag. Underlining the reason too says the prose is at fault when the
	// mistake is one character in a path, and the wider the squiggle the less it
	// points at anything. Zero when the tag has no target.
	TargetPos int
	TargetEnd int
}

// targetRange returns the span to underline for a complaint about the target,
// falling back to the whole tag when the target span is unknown.
func (tag evidenceTag) targetRange() (int, int) {
	if tag.TargetPos == 0 && tag.TargetEnd == 0 {
		return tag.Pos, tag.End
	}
	return tag.TargetPos, tag.TargetEnd
}

// evidenceTagName is the JSDoc tag this plugin owns.
const evidenceTagName = "evidence"

// parseEvidenceComment splits a raw `@evidence` comment body into target and
// reason.
//
// The grammar is the ordinary JSDoc tag shape — `@name <key> <prose>`, exactly
// as `@param name description` works — so the first token is the key and the
// remainder is free text. That shape is what makes the split unambiguous: a
// reason contains spaces, so any ordering with the reason first would have no
// boundary to split on.
//
// Returns ok=false when there is no target at all. A missing reason is NOT a
// parse failure: it is a rule violation, and the caller reports it with a
// message about proof rather than about syntax.
func parseEvidenceComment(comment string) (target string, reason string, ok bool) {
	trimmed := strings.TrimSpace(comment)
	if trimmed == "" {
		return "", "", false
	}
	index := strings.IndexFunc(trimmed, func(char rune) bool {
		return char == ' ' || char == '\t' || char == '\n' || char == '\r'
	})
	if index == -1 {
		return trimmed, "", true
	}
	return trimmed[:index], strings.TrimSpace(trimmed[index+1:]), true
}

// classifyTarget decides how a target is addressed.
//
// The rule is deliberately simple and stated in one place, because two
// implementations of it would drift and every drift is a reference that
// resolves against the wrong node kind:
//
//	contains '#' or ends in '.md'  ->  document
//	otherwise                      ->  symbol
//
// A target with a '/' but no '.md' is a document reference too — it names a
// path, and calling it a symbol would produce a baffling "no such symbol
// docs/spec" diagnostic instead of naming the real mistake.
func classifyTarget(target string) (kind referenceKind, path string, anchor string) {
	if target == "" {
		return referenceKindUnknown, "", ""
	}
	hash := strings.IndexByte(target, '#')
	if hash != -1 {
		return referenceKindDocument, target[:hash], target[hash+1:]
	}
	if strings.HasSuffix(target, ".md") || strings.Contains(target, "/") {
		return referenceKindDocument, target, ""
	}
	return referenceKindSymbol, "", ""
}

// newEvidenceTag builds a tag from a raw comment body and its source range.
func newEvidenceTag(comment string, pos int, end int) (evidenceTag, bool) {
	target, reason, ok := parseEvidenceComment(comment)
	if !ok {
		return evidenceTag{Pos: pos, End: end}, false
	}
	kind, path, anchor := classifyTarget(target)
	return evidenceTag{
		Target: target,
		Reason: reason,
		Kind:   kind,
		Path:   path,
		Anchor: anchor,
		Pos:    pos,
		End:    end,
	}, true
}

// normalizePath makes a project-relative path comparable to an index key.
//
// It does not resolve `..`: a target that climbs out of the project is a
// mistake the index will refuse to resolve, and silently normalizing it would
// hide that mistake behind a "not found" that names the wrong path.
func normalizePath(value string) string {
	value = strings.ReplaceAll(value, "\\", "/")
	value = strings.TrimPrefix(value, "./")
	return value
}
