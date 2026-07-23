package evidence

import "strings"

type parsedDeclaration struct {
	Tag        tagKind
	Target     string
	Reason     string
	LineOffset int
}

func parseDeclarations(comment string) []parsedDeclaration {
	comment = strings.TrimSpace(comment)
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
			LineOffset: pending.lineOffset,
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
		if strings.HasPrefix(line, "@") {
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
		if char == ' ' || char == '\t' || char == '\r' || char == '\n' {
			return body[:index], strings.TrimSpace(body[index:])
		}
	}
	return body, ""
}

func normalizeTarget(target string) string {
	if strings.Contains(target, "/") ||
		strings.Contains(target, "\\") ||
		strings.Contains(target, "#") ||
		strings.HasSuffix(strings.ToLower(target), ".md") {
		target = strings.ReplaceAll(target, "\\", "/")
		for strings.HasPrefix(target, "./") {
			target = strings.TrimPrefix(target, "./")
		}
	}
	return target
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
