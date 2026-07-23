package evidence

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/url"
	"path"
	"sort"
	"strings"
)

func decodeGraphConfig(raw json.RawMessage) (graphConfig, []string) {
	var config graphConfig
	if len(bytes.TrimSpace(raw)) == 0 {
		return config, []string{
			"Invalid evidence-graph/index configuration: the rule requires an IEvidenceGraphConfig options object. Configure it as ['error', { claims: [...] }].",
		}
	}
	object, problem := decodeObject(raw, "configuration")
	if problem != "" {
		return config, []string{problem}
	}
	problems := rejectUnknownFields(object, []string{"claims"}, "configuration")
	claimRaw, exists := object["claims"]
	if !exists {
		problems = append(problems, "Invalid evidence-graph/index configuration at claims: the required claim array is missing.")
		return config, problems
	}
	var claims []json.RawMessage
	if err := json.Unmarshal(claimRaw, &claims); err != nil {
		problems = append(problems, "Invalid evidence-graph/index configuration at claims: expected an array of Markdown or TypeScript claims.")
		return config, problems
	}
	if len(claims) == 0 {
		problems = append(problems, "Invalid evidence-graph/index configuration at claims: at least one claim is required; an empty graph cannot establish evidence coverage.")
		return config, problems
	}
	for index, claimRaw := range claims {
		claim, claimProblems := decodeClaim(claimRaw, index)
		problems = append(problems, claimProblems...)
		if len(claimProblems) == 0 {
			config.Claims = append(config.Claims, claim)
		}
	}
	return config, problems
}

func decodeClaim(raw json.RawMessage, index int) (claimSpec, []string) {
	path := fmt.Sprintf("claims[%d]", index)
	object, problem := decodeObject(raw, path)
	if problem != "" {
		return claimSpec{}, []string{problem}
	}
	problems := rejectUnknownFields(
		object,
		[]string{"type", "name", "files", "symbol", "reference"},
		path,
	)
	kind, kindProblem := decodeArtifactKind(object["type"], path+".type", false)
	if kindProblem != "" {
		problems = append(problems, kindProblem)
	}
	name := ""
	if rawName, exists := object["name"]; exists {
		if err := json.Unmarshal(rawName, &name); err != nil {
			problems = append(problems, "Invalid evidence-graph/index configuration at "+path+".name: expected a diagnostic-only string label.")
		}
	}
	files, fileProblems := decodeFiles(object["files"], path+".files")
	problems = append(problems, fileProblems...)
	symbols, symbolProblems := decodeSymbols(object["symbol"], kind, false, path+".symbol")
	problems = append(problems, symbolProblems...)
	references, referenceProblems := decodeReferences(object["reference"], path+".reference")
	problems = append(problems, referenceProblems...)
	if len(problems) != 0 {
		return claimSpec{}, problems
	}
	return claimSpec{
		Index:      index,
		Type:       kind,
		Name:       name,
		Files:      files,
		Symbols:    symbols,
		References: references,
	}, nil
}

func decodeReferences(raw json.RawMessage, path string) ([]referenceSpec, []string) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, []string{"Invalid evidence-graph/index configuration at " + path + ": the required evidence reference is missing."}
	}
	trimmed := bytes.TrimSpace(raw)
	elements := []json.RawMessage{}
	switch trimmed[0] {
	case '{':
		elements = append(elements, raw)
	case '[':
		if err := json.Unmarshal(raw, &elements); err != nil {
			return nil, []string{"Invalid evidence-graph/index configuration at " + path + ": expected one reference object or an array of reference objects."}
		}
		if len(elements) == 0 {
			return nil, []string{"Invalid evidence-graph/index configuration at " + path + ": an empty reference array creates no coverage obligation; provide at least one evidence reference."}
		}
	default:
		return nil, []string{"Invalid evidence-graph/index configuration at " + path + ": expected one reference object or an array of reference objects."}
	}
	references := make([]referenceSpec, 0, len(elements))
	problems := []string{}
	for index, element := range elements {
		referencePath := path
		if len(elements) > 1 || trimmed[0] == '[' {
			referencePath += "[" + decimal(index) + "]"
		}
		reference, referenceProblems := decodeReference(element, index, referencePath)
		problems = append(problems, referenceProblems...)
		if len(referenceProblems) == 0 {
			references = append(references, reference)
		}
	}
	return references, problems
}

func decodeReference(raw json.RawMessage, index int, path string) (referenceSpec, []string) {
	object, problem := decodeObject(raw, path)
	if problem != "" {
		return referenceSpec{}, []string{problem}
	}
	problems := rejectUnknownFields(
		object,
		[]string{"type", "file", "files", "symbol"},
		path,
	)
	kind, kindProblem := decodeArtifactKind(object["type"], path+".type", true)
	if kindProblem != "" {
		problems = append(problems, kindProblem)
	}
	files := globSet{}
	source := ""
	symbols := symbolSet{}
	if kind == artifactSwagger {
		if _, exists := object["files"]; exists {
			problems = append(
				problems,
				"Invalid evidence-graph/index configuration at "+path+".files: a Swagger reference owns one document; use singular 'file' and a reference array for multiple documents.",
			)
		}
		if _, exists := object["symbol"]; exists {
			problems = append(
				problems,
				"Invalid evidence-graph/index configuration at "+path+".symbol: Swagger references select every operation and do not accept a symbol selector.",
			)
		}
		var sourceProblem string
		source, sourceProblem = decodeSwaggerSource(object["file"], path+".file")
		if sourceProblem != "" {
			problems = append(problems, sourceProblem)
		}
		symbols["operation"] = true
	} else {
		if _, exists := object["file"]; exists {
			problems = append(
				problems,
				"Invalid evidence-graph/index configuration at "+path+".file: singular 'file' is only supported by Swagger references; Markdown and TypeScript references use 'files' globs.",
			)
		}
		var fileProblems []string
		files, fileProblems = decodeFiles(object["files"], path+".files")
		problems = append(problems, fileProblems...)
		var symbolProblems []string
		symbols, symbolProblems = decodeSymbols(object["symbol"], kind, true, path+".symbol")
		problems = append(problems, symbolProblems...)
	}
	if len(problems) != 0 {
		return referenceSpec{}, problems
	}
	return referenceSpec{
		Index:   index,
		Type:    kind,
		Files:   files,
		Source:  source,
		Symbols: symbols,
	}, nil
}

func decodeArtifactKind(
	raw json.RawMessage,
	path string,
	allowSwagger bool,
) (artifactKind, string) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return "", "Invalid evidence-graph/index configuration at " + path + ": the artifact discriminator is required."
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return "", "Invalid evidence-graph/index configuration at " + path + ": expected a supported artifact type string."
	}
	switch artifactKind(value) {
	case artifactMarkdown, artifactTypeScript:
		return artifactKind(value), ""
	case artifactSwagger:
		if allowSwagger {
			return artifactSwagger, ""
		}
		return "", "Invalid evidence-graph/index configuration at " + path + ": Swagger is evidence-only and cannot be a claim; expected 'markdown' or 'typescript'."
	default:
		expected := "'markdown' or 'typescript'"
		if allowSwagger {
			expected = "'markdown', 'swagger', or 'typescript'"
		}
		return "", "Invalid evidence-graph/index configuration at " + path + ": unsupported artifact type '" + value + "'; expected " + expected + "."
	}
}

func decodeSwaggerSource(raw json.RawMessage, configPath string) (string, string) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return "", "Invalid evidence-graph/index configuration at " + configPath + ": the required Swagger file path or URL is missing."
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return "", "Invalid evidence-graph/index configuration at " + configPath + ": expected one exact project-relative file path or http(s) URL."
	}
	source, problem := normalizeSwaggerSource(value)
	if problem != "" {
		return "", "Invalid evidence-graph/index configuration at " + configPath + ": " + problem
	}
	return source, ""
}

func normalizeSwaggerSource(value string) (string, string) {
	if value == "" {
		return "", "Swagger sources must not be empty."
	}
	if strings.TrimSpace(value) != value {
		return "", "Swagger sources must not have leading or trailing whitespace."
	}
	parsed, err := url.Parse(value)
	if err != nil {
		return "", "invalid Swagger source '" + value + "': " + err.Error() + "."
	}
	if parsed.Scheme != "" {
		if parsed.Scheme != "http" && parsed.Scheme != "https" {
			return "", "unsupported URL scheme '" + parsed.Scheme + "'; only http: and https: are supported."
		}
		if parsed.Host == "" {
			return "", "Swagger URL '" + value + "' has no host."
		}
		if parsed.Fragment != "" {
			return "", "Swagger URL '" + value + "' must not contain a fragment."
		}
		return value, ""
	}
	if strings.Contains(value, "://") {
		return "", "invalid Swagger source URL '" + value + "'."
	}
	normalized := strings.ReplaceAll(value, "\\", "/")
	if strings.HasPrefix(normalized, "/") || path.IsAbs(normalized) {
		return "", "local Swagger paths must be project-relative."
	}
	normalized = path.Clean(normalized)
	for strings.HasPrefix(normalized, "./") {
		normalized = strings.TrimPrefix(normalized, "./")
	}
	if normalized == "." || normalized == ".." || strings.HasPrefix(normalized, "../") {
		return "", "local Swagger paths must name a file below the project root."
	}
	return normalized, ""
}

func decodeFiles(raw json.RawMessage, path string) (globSet, []string) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return globSet{}, []string{"Invalid evidence-graph/index configuration at " + path + ": the required project-relative glob array is missing."}
	}
	var patterns []string
	if err := json.Unmarshal(raw, &patterns); err != nil {
		return globSet{}, []string{"Invalid evidence-graph/index configuration at " + path + ": expected an array of project-relative glob strings."}
	}
	if len(patterns) == 0 {
		return globSet{}, []string{"Invalid evidence-graph/index configuration at " + path + ": at least one positive glob is required."}
	}
	globs, err := newGlobSet(patterns)
	if err != nil {
		return globSet{}, []string{"Invalid evidence-graph/index configuration at " + path + ": " + err.Error()}
	}
	return globs, nil
}

func decodeSymbols(
	raw json.RawMessage,
	kind artifactKind,
	unit bool,
	path string,
) (symbolSet, []string) {
	if kind == "" {
		return nil, nil
	}
	values := []string{}
	if len(bytes.TrimSpace(raw)) == 0 {
		switch {
		case kind == artifactMarkdown:
			values = []string{"file", "h1", "h2", "h3", "h4"}
		case kind == artifactTypeScript && unit:
			values = []string{"type"}
		default:
			values = []string{"type", "function", "property"}
		}
	} else {
		trimmed := bytes.TrimSpace(raw)
		switch trimmed[0] {
		case '"':
			var value string
			if err := json.Unmarshal(raw, &value); err != nil {
				return nil, []string{"Invalid evidence-graph/index configuration at " + path + ": expected a supported symbol string or array."}
			}
			values = []string{value}
		case '[':
			if err := json.Unmarshal(raw, &values); err != nil {
				return nil, []string{"Invalid evidence-graph/index configuration at " + path + ": expected a supported symbol string or array."}
			}
			if len(values) == 0 {
				return nil, []string{"Invalid evidence-graph/index configuration at " + path + ": an empty symbol array selects no evidence units or declaration hosts."}
			}
		default:
			return nil, []string{"Invalid evidence-graph/index configuration at " + path + ": expected a supported symbol string or array."}
		}
	}
	allowed := map[string]bool{}
	if kind == artifactMarkdown {
		for _, symbol := range []string{"file", "h1", "h2", "h3", "h4"} {
			allowed[symbol] = true
		}
	} else {
		for _, symbol := range []string{"type", "function", "property"} {
			allowed[symbol] = true
		}
	}
	set := symbolSet{}
	problems := []string{}
	for _, value := range values {
		if !allowed[value] {
			problems = append(problems, "Invalid evidence-graph/index configuration at "+path+": symbol '"+value+"' is not supported for "+string(kind)+".")
			continue
		}
		set[value] = true
	}
	return set, problems
}

func decodeObject(raw json.RawMessage, path string) (map[string]json.RawMessage, string) {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(raw, &object); err != nil || object == nil {
		return nil, "Invalid evidence-graph/index configuration at " + path + ": expected an object."
	}
	return object, ""
}

func rejectUnknownFields(
	object map[string]json.RawMessage,
	allowed []string,
	path string,
) []string {
	known := map[string]bool{}
	for _, name := range allowed {
		known[name] = true
	}
	unknown := []string{}
	for name := range object {
		if !known[name] {
			unknown = append(unknown, name)
		}
	}
	sort.Strings(unknown)
	problems := make([]string, 0, len(unknown))
	for _, name := range unknown {
		if name == "severity" {
			problems = append(
				problems,
				"Invalid evidence-graph/index configuration at "+path+".severity: severity belongs only in the outer @ttsc/lint rule setting.",
			)
			continue
		}
		if name == "sources" {
			problems = append(
				problems,
				"Invalid evidence-graph/index configuration at "+path+".sources: the graph is now declared from the claiming side; declare 'claims', each citing its evidence under 'reference'.",
			)
			continue
		}
		if name == "citedBy" {
			problems = append(
				problems,
				"Invalid evidence-graph/index configuration at "+path+".citedBy: this relation was inverted; declare the evidence this claim cites under 'reference'.",
			)
			continue
		}
		problems = append(
			problems,
			"Invalid evidence-graph/index configuration at "+path+"."+name+": unknown property; expected only "+strings.Join(allowed, ", ")+".",
		)
	}
	return problems
}

func describePatterns(globs globSet) string {
	quoted := make([]string, 0, len(globs.Patterns))
	for _, pattern := range globs.Patterns {
		quoted = append(quoted, "'"+pattern.Raw+"'")
	}
	return "[" + strings.Join(quoted, ", ") + "]"
}

func describeReferenceSources(reference referenceSpec) string {
	if reference.Type != artifactSwagger {
		return describePatterns(reference.Files)
	}
	return "'" + displaySwaggerSource(reference.Source) + "'"
}
