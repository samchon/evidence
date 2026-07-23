package evidence

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

func decodeGraphConfig(raw json.RawMessage) (graphConfig, []string) {
	var config graphConfig
	if len(bytes.TrimSpace(raw)) == 0 {
		return config, []string{
			"Invalid evidence-graph/index configuration: the rule requires an IEvidenceGraphConfig options object. Configure it as ['error', { sources: [...] }].",
		}
	}
	object, problem := decodeObject(raw, "configuration")
	if problem != "" {
		return config, []string{problem}
	}
	problems := rejectUnknownFields(object, []string{"sources"}, "configuration")
	sourceRaw, exists := object["sources"]
	if !exists {
		problems = append(problems, "Invalid evidence-graph/index configuration at sources: the required source array is missing.")
		return config, problems
	}
	var sources []json.RawMessage
	if err := json.Unmarshal(sourceRaw, &sources); err != nil {
		problems = append(problems, "Invalid evidence-graph/index configuration at sources: expected an array of Markdown or TypeScript sources.")
		return config, problems
	}
	if len(sources) == 0 {
		problems = append(problems, "Invalid evidence-graph/index configuration at sources: at least one source is required; an empty graph cannot establish evidence coverage.")
		return config, problems
	}
	for index, sourceRaw := range sources {
		source, sourceProblems := decodeSource(sourceRaw, index)
		problems = append(problems, sourceProblems...)
		if len(sourceProblems) == 0 {
			config.Sources = append(config.Sources, source)
		}
	}
	return config, problems
}

func decodeSource(raw json.RawMessage, index int) (sourceSpec, []string) {
	path := fmt.Sprintf("sources[%d]", index)
	object, problem := decodeObject(raw, path)
	if problem != "" {
		return sourceSpec{}, []string{problem}
	}
	problems := rejectUnknownFields(
		object,
		[]string{"type", "name", "files", "symbol", "reference"},
		path,
	)
	kind, kindProblem := decodeArtifactKind(object["type"], path+".type")
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
	symbols, symbolProblems := decodeSymbols(object["symbol"], kind, true, path+".symbol")
	problems = append(problems, symbolProblems...)
	references, referenceProblems := decodeReferences(object["reference"], path+".reference")
	problems = append(problems, referenceProblems...)
	if len(problems) != 0 {
		return sourceSpec{}, problems
	}
	return sourceSpec{
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
		return nil, []string{"Invalid evidence-graph/index configuration at " + path + ": the required reference group is missing."}
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
			return nil, []string{"Invalid evidence-graph/index configuration at " + path + ": an empty reference array creates no coverage obligation; provide at least one group."}
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
	problems := rejectUnknownFields(object, []string{"type", "files", "symbol"}, path)
	kind, kindProblem := decodeArtifactKind(object["type"], path+".type")
	if kindProblem != "" {
		problems = append(problems, kindProblem)
	}
	files, fileProblems := decodeFiles(object["files"], path+".files")
	problems = append(problems, fileProblems...)
	symbols, symbolProblems := decodeSymbols(object["symbol"], kind, false, path+".symbol")
	problems = append(problems, symbolProblems...)
	if len(problems) != 0 {
		return referenceSpec{}, problems
	}
	return referenceSpec{Index: index, Type: kind, Files: files, Symbols: symbols}, nil
}

func decodeArtifactKind(raw json.RawMessage, path string) (artifactKind, string) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return "", "Invalid evidence-graph/index configuration at " + path + ": the artifact discriminator is required."
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return "", "Invalid evidence-graph/index configuration at " + path + ": expected 'markdown' or 'typescript'."
	}
	switch artifactKind(value) {
	case artifactMarkdown, artifactTypeScript:
		return artifactKind(value), ""
	default:
		return "", "Invalid evidence-graph/index configuration at " + path + ": unsupported artifact type '" + value + "'; expected 'markdown' or 'typescript'."
	}
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
	source bool,
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
		case kind == artifactTypeScript && source:
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
