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

func splitDeclarationBody(body string) (string, string) {
	body = strings.TrimSpace(body)
	if body == "" {
		return "", ""
	}
	for index, char := range body {
		if unicode.IsSpace(char) {
			return body[:index], strings.TrimSpace(body[index:])
		}
	}
	return body, ""
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
