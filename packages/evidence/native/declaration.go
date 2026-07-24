package evidence

import (
	"strings"
	"unicode"
)

type parsedDeclaration struct {
	Tag        tagKind
	Target     string
	Reason     string
	LineOffset int
}

func parseDeclarations(comment string) []parsedDeclaration {
	trimmed := strings.TrimLeftFunc(comment, unicode.IsSpace)
	leadingLines := strings.Count(comment[:len(comment)-len(trimmed)], "\n")
	comment = trimmed
	jsdoc := strings.HasPrefix(comment, "/**")
	comment = strings.TrimPrefix(comment, "/**")
	comment = strings.TrimPrefix(comment, "/*")
	comment = strings.TrimSuffix(comment, "*/")
	lines := strings.Split(comment, "\n")
	type pendingDeclaration struct {
		tag        tagKind
		body       []string
		lineOffset int
	}
	var pending *pendingDeclaration
	parsed := []parsedDeclaration{}
	flush := func() {
		if pending == nil {
			return
		}
		target, reason := splitDeclarationBody(strings.Join(pending.body, "\n"))
		parsed = append(parsed, parsedDeclaration{
			Tag:        pending.tag,
			Target:     target,
			Reason:     reason,
			LineOffset: leadingLines + pending.lineOffset,
		})
		pending = nil
	}
	for index, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		line = strings.TrimSpace(strings.TrimPrefix(line, "*"))
		tag, body, found := declarationLine(line)
		if found {
			flush()
			pending = &pendingDeclaration{
				tag:        tag,
				body:       []string{body},
				lineOffset: index,
			}
			continue
		}
		if jsdoc && strings.HasPrefix(line, "@") {
			flush()
			continue
		}
		if pending != nil {
			pending.body = append(pending.body, line)
		}
	}
	flush()
	return parsed
}

func declarationLine(line string) (tagKind, string, bool) {
	for _, candidate := range []struct {
		marker string
		tag    tagKind
	}{
		{marker: "@evidenceExclude", tag: tagExclude},
		{marker: "@evidence", tag: tagEvidence},
	} {
		if !strings.HasPrefix(line, candidate.marker) {
			continue
		}
		remainder := line[len(candidate.marker):]
		if remainder != "" && remainder[0] != ' ' && remainder[0] != '\t' {
			continue
		}
		return candidate.tag, strings.TrimSpace(remainder), true
	}
	return "", "", false
}

// inlineLinkTags are the JSDoc inline link forms a TypeScript target may use.
//
// TypeScript resolves the name inside one of these and counts it as a use,
// which is the only reason a citation-only import survives `noUnusedLocals`.
// No other tag earns that, so no other tag may open a target.
var inlineLinkTags = []string{"{@linkcode", "{@linkplain", "{@link"}

func splitDeclarationBody(body string) (string, string) {
	body = strings.TrimSpace(body)
	if body == "" {
		return "", ""
	}
	if target, reason, found := splitInlineLinkBody(body); found {
		return target, reason
	}
	for index, char := range body {
		if unicode.IsSpace(char) {
			return body[:index], strings.TrimSpace(body[index:])
		}
	}
	return body, ""
}

// splitInlineLinkBody consumes a braced target through its closing brace.
//
// The brace supplies the boundary a whitespace-delimited token cannot, so the
// grammar stays self-discriminating: the parser decides which resolver applies
// from the token alone, with no reference context. That is what keeps the
// `POST /members` hazard from recurring in a new form.
func splitInlineLinkBody(body string) (string, string, bool) {
	marker := ""
	for _, candidate := range inlineLinkTags {
		if strings.HasPrefix(body, candidate) {
			marker = candidate
			break
		}
	}
	if marker == "" {
		return "", "", false
	}
	closing := strings.IndexByte(body, '}')
	if closing < 0 {
		// An unterminated link is a malformed declaration rather than a plain
		// token: reporting it as the target `{@link` would name a repair the
		// author cannot make.
		return "", "", false
	}
	inner := strings.TrimSpace(body[len(marker):closing])
	reason := strings.TrimSpace(body[closing+1:])
	if inner == "" || containsWhitespace(inner) {
		return "", "", false
	}
	return inlineLinkPrefix + inner, reason, true
}

// inlineLinkPrefix marks a parsed target as import-scope resolved.
//
// Carrying the discrimination in the value keeps every downstream consumer —
// resolution, diagnostics, duplicate detection — reading one field instead of
// re-parsing the comment to recover what the parser already knew.
const inlineLinkPrefix = "\x00link:"

func isInlineLinkTarget(target string) bool {
	return strings.HasPrefix(target, inlineLinkPrefix)
}

func inlineLinkTarget(target string) string {
	return strings.TrimPrefix(target, inlineLinkPrefix)
}

// displayTarget renders a target the way its author wrote it.
func displayTarget(target string) string {
	if isInlineLinkTarget(target) {
		return "{@link " + inlineLinkTarget(target) + "}"
	}
	return target
}

func normalizeMarkdownTarget(target string) string {
	target = strings.ReplaceAll(target, "\\", "/")
	for strings.HasPrefix(target, "./") {
		target = strings.TrimPrefix(target, "./")
	}
	return target
}

func containsWhitespace(value string) bool {
	for _, char := range value {
		if unicode.IsSpace(char) {
			return true
		}
	}
	return false
}

func lineAt(content string, offset int) int {
	if offset < 0 {
		return 1
	}
	if offset > len(content) {
		offset = len(content)
	}
	return 1 + strings.Count(content[:offset], "\n")
}
