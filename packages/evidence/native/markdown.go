package evidence

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"unicode"
)

var markdownCommentPattern = regexp.MustCompile(`(?s)<!--(.*?)-->`)
var explicitAnchorPattern = regexp.MustCompile(`\s*\{#([A-Za-z0-9][A-Za-z0-9._:-]*)\}\s*$`)

func loadMarkdownInventories(
	root string,
	config graphConfig,
) (map[string]*artifactInventory, []string) {
	inventories := map[string]*artifactInventory{}
	problems := []string{}
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			relative, ok := relativeProjectPath(root, path)
			relevant := ok &&
				(matchesConfiguredMarkdownFile(config, relative) ||
					couldContainConfiguredMarkdown(config, relative))
			if !relevant {
				if entry != nil && entry.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			problems = append(problems, "Evidence graph could not inspect '"+path+"': "+walkErr.Error()+". Fix filesystem access so configured Markdown sources can be indexed.")
			if entry != nil && entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.IsDir() {
			if path != root {
				relative, ok := relativeProjectPath(root, path)
				if !ok || !couldContainConfiguredMarkdown(config, relative) {
					return filepath.SkipDir
				}
			}
			return nil
		}
		relative, ok := relativeProjectPath(root, path)
		if !ok {
			return nil
		}
		if !matchesConfiguredMarkdownFile(config, relative) {
			return nil
		}
		content, readErr := os.ReadFile(path)
		if readErr != nil {
			inventories[relative] = &artifactInventory{
				Path: relative,
				Type: artifactMarkdown,
			}
			problems = append(problems, "Evidence graph could not read Markdown file '"+relative+"': "+readErr.Error()+". Fix filesystem access or exclude the file from configured globs.")
			return nil
		}
		inventory, _ := scanMarkdownInventory(relative, string(content))
		inventories[relative] = inventory
		for _, inventoryProblem := range inventory.Problems {
			if selectedByMarkdownSource(config, relative, inventoryProblem.Symbol) {
				problems = append(problems, inventoryProblem.Message)
			}
		}
		return nil
	})
	if err != nil {
		problems = append(problems, "Evidence graph could not walk project root '"+root+"': "+err.Error()+".")
	}
	return inventories, problems
}

func scanMarkdownInventory(path string, content string) (*artifactInventory, []string) {
	inventory := &artifactInventory{Path: path, Type: artifactMarkdown}
	problems := []string{}
	targetablePath := !containsWhitespace(path)
	if targetablePath {
		inventory.Units = append(inventory.Units, &evidenceUnit{
			ID:       "markdown:" + path + ":file",
			Target:   path,
			Type:     artifactMarkdown,
			Symbol:   "file",
			Path:     path,
			Line:     1,
			Readable: "Markdown file",
		})
	} else {
		problem := "Markdown file '" + path + "' cannot form an evidence target because its project-relative path contains whitespace. Rename the file so '@evidence <target> <reason>' can represent its path as one target token."
		problems = append(problems, problem)
		inventory.Problems = append(inventory.Problems, inventoryProblem{
			Symbol:  "*",
			Message: problem,
		})
	}

	lines := strings.Split(content, "\n")
	hostAtLine := make([]string, len(lines))
	fencedAtLine := make([]bool, len(lines))
	currentHost := "file"
	fenceMarker := rune(0)
	fenceLength := 0
	inHTMLComment := false
	for index, rawLine := range lines {
		line := strings.TrimSuffix(rawLine, "\r")
		trimmed := strings.TrimLeft(line, " \t")
		if marker, length, remainder, ok := markdownFence(line); ok {
			fencedAtLine[index] = true
			if fenceMarker == 0 {
				fenceMarker = marker
				fenceLength = length
			} else if marker == fenceMarker &&
				length >= fenceLength &&
				strings.TrimSpace(remainder) == "" {
				fenceMarker = 0
				fenceLength = 0
			}
			hostAtLine[index] = currentHost
			continue
		}
		if fenceMarker != 0 {
			fencedAtLine[index] = true
			hostAtLine[index] = currentHost
			continue
		}
		if inHTMLComment {
			if strings.Contains(trimmed, "-->") {
				inHTMLComment = false
			}
			hostAtLine[index] = currentHost
			continue
		}
		if strings.HasPrefix(trimmed, "<!--") {
			remainder := strings.TrimPrefix(trimmed, "<!--")
			if !strings.Contains(remainder, "-->") {
				inHTMLComment = true
			}
			hostAtLine[index] = currentHost
			continue
		}
		level, title, ok := markdownHeading(line)
		if ok {
			currentHost = "h" + decimal(level)
			if level <= 4 && targetablePath {
				title, anchor := markdownHeadingIdentity(title)
				if anchor == "" {
					problems = append(
						problems,
						"Markdown evidence unit at "+path+":"+decimal(index+1)+" has no resolvable anchor. Add a non-empty heading title or an explicit '{#anchor}' suffix.",
					)
					inventory.Problems = append(inventory.Problems, inventoryProblem{
						Symbol:  currentHost,
						Message: problems[len(problems)-1],
					})
				} else {
					inventory.Units = append(inventory.Units, &evidenceUnit{
						ID:       "markdown:" + path + ":" + currentHost + ":" + decimal(index+1),
						Target:   path + "#" + anchor,
						Type:     artifactMarkdown,
						Symbol:   currentHost,
						Path:     path,
						Line:     index + 1,
						Readable: "Markdown " + strings.ToUpper(currentHost) + " '" + title + "'",
					})
				}
			}
		}
		hostAtLine[index] = currentHost
	}

	sequence := 0
	for _, match := range markdownCommentPattern.FindAllStringSubmatchIndex(content, -1) {
		if len(match) < 4 {
			continue
		}
		commentStart := match[0]
		line := lineAt(content, commentStart)
		if line <= 0 || line > len(lines) || fencedAtLine[line-1] {
			continue
		}
		comment := content[match[2]:match[3]]
		for _, parsed := range parseDeclarations(comment) {
			sequence++
			inventory.Declarations = append(inventory.Declarations, &evidenceDeclaration{
				ID:       "markdown:" + path + ":" + decimal(line+parsed.LineOffset) + ":" + decimal(sequence),
				Tag:      parsed.Tag,
				Target:   normalizeTarget(parsed.Target),
				Reason:   parsed.Reason,
				Host:     hostAtLine[line-1],
				Path:     path,
				Line:     line + parsed.LineOffset,
				Sequence: sequence,
			})
		}
	}
	return inventory, problems
}

func matchesConfiguredMarkdownFile(config graphConfig, path string) bool {
	for _, source := range config.Sources {
		if source.Type == artifactMarkdown && source.Files.matches(path) {
			return true
		}
		for _, reference := range source.References {
			if reference.Type == artifactMarkdown && reference.Files.matches(path) {
				return true
			}
		}
	}
	return false
}

func couldContainConfiguredMarkdown(config graphConfig, directory string) bool {
	for _, source := range config.Sources {
		if source.Type == artifactMarkdown &&
			source.Files.couldMatchDescendant(directory) {
			return true
		}
		for _, reference := range source.References {
			if reference.Type == artifactMarkdown &&
				reference.Files.couldMatchDescendant(directory) {
				return true
			}
		}
	}
	return false
}

func selectedByMarkdownSource(
	config graphConfig,
	path string,
	symbol string,
) bool {
	for _, source := range config.Sources {
		if source.Type == artifactMarkdown &&
			source.Files.matches(path) &&
			(symbol == "*" || source.Symbols.contains(symbol)) {
			return true
		}
	}
	return false
}

func markdownFence(line string) (rune, int, string, bool) {
	indent := 0
	for indent < len(line) && line[indent] == ' ' {
		indent++
	}
	if indent > 3 {
		return 0, 0, "", false
	}
	runes := []rune(line[indent:])
	if len(runes) < 3 || (runes[0] != '`' && runes[0] != '~') {
		return 0, 0, "", false
	}
	count := 1
	for count < len(runes) && runes[count] == runes[0] {
		count++
	}
	if count < 3 {
		return 0, 0, "", false
	}
	remainder := string(runes[count:])
	if runes[0] == '`' && strings.Contains(remainder, "`") {
		return 0, 0, "", false
	}
	return runes[0], count, remainder, true
}

func markdownHeading(line string) (int, string, bool) {
	space := 0
	for space < len(line) && line[space] == ' ' && space < 4 {
		space++
	}
	if space > 3 || space >= len(line) || line[space] != '#' {
		return 0, "", false
	}
	level := 0
	for space+level < len(line) && line[space+level] == '#' {
		level++
	}
	if level == 0 || level > 6 {
		return 0, "", false
	}
	next := space + level
	if next < len(line) && line[next] != ' ' && line[next] != '\t' {
		return 0, "", false
	}
	title := strings.TrimSpace(line[next:])
	trimmedHashes := strings.TrimRight(title, "#")
	if trimmedHashes != title && (trimmedHashes == "" || strings.HasSuffix(trimmedHashes, " ") || strings.HasSuffix(trimmedHashes, "\t")) {
		title = strings.TrimSpace(trimmedHashes)
	}
	return level, title, true
}

func markdownHeadingIdentity(title string) (string, string) {
	if match := explicitAnchorPattern.FindStringSubmatch(title); len(match) == 2 {
		cleanTitle := strings.TrimSpace(explicitAnchorPattern.ReplaceAllString(title, ""))
		return cleanTitle, match[1]
	}
	return title, markdownSlug(title)
}

func markdownSlug(title string) string {
	var builder strings.Builder
	lastHyphen := false
	for _, char := range strings.ToLower(title) {
		switch {
		case unicode.IsLetter(char), unicode.IsNumber(char), char == '_':
			builder.WriteRune(char)
			lastHyphen = false
		case char == '-' || unicode.IsSpace(char):
			if builder.Len() > 0 && !lastHyphen {
				builder.WriteRune('-')
				lastHyphen = true
			}
		}
	}
	return strings.Trim(builder.String(), "-")
}
