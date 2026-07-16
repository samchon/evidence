package evidence

import "strings"

// Glob matching over slash-separated, project-relative paths.
//
// Hand-rolled because ttsc supplies this package's dependencies from
// @ttsc/lint's module graph, so a third-party matcher such as doublestar is not
// importable no matter what this package's local go.mod says. Standard
// path.Match cannot help either: it has no `**` and its `*` refuses to cross a
// separator, which is the one thing a folder policy needs.
//
// Supported syntax, matching the common .gitignore/editor subset:
//
//	**   any number of path segments, including none
//	*    any run of characters within one segment
//	?    exactly one character within one segment
//
// Paths are compared case-sensitively. Case is identity: a case-insensitive
// host still has one true spelling for a file, and matching `Docs/` against
// `docs/` would silently admit a path the document index cannot resolve.
func matchGlob(pattern string, name string) bool {
	return matchSegments(splitPath(pattern), splitPath(name))
}

// matchAnyGlob reports whether name matches at least one pattern. An empty
// pattern list matches nothing, never everything: a policy that lost its
// patterns must go quiet rather than silently apply to the whole repository.
func matchAnyGlob(patterns []string, name string) bool {
	for _, pattern := range patterns {
		if matchGlob(pattern, name) {
			return true
		}
	}
	return false
}

func splitPath(value string) []string {
	value = strings.ReplaceAll(value, "\\", "/")
	value = strings.TrimPrefix(value, "./")
	if value == "" {
		return nil
	}
	return strings.Split(value, "/")
}

// matchSegments walks pattern and name in lockstep. A `**` segment recurses
// over every suffix of the remaining name, which keeps the "zero or more
// segments" semantics exact at both ends without special-casing them.
func matchSegments(pattern []string, name []string) bool {
	if len(pattern) == 0 {
		return len(name) == 0
	}
	if pattern[0] == "**" {
		for index := 0; index <= len(name); index++ {
			if matchSegments(pattern[1:], name[index:]) {
				return true
			}
		}
		return false
	}
	if len(name) == 0 {
		return false
	}
	if !matchSegment(pattern[0], name[0]) {
		return false
	}
	return matchSegments(pattern[1:], name[1:])
}

// matchSegment matches one path segment, where `*` and `?` never cross a
// separator because the caller has already split on them.
func matchSegment(pattern string, name string) bool {
	// Index into pattern and name, plus the backtrack point of the most recent
	// `*`. Iterative rather than recursive so a pathological pattern such as
	// `*a*a*a*a*b` cannot blow the stack on hostile input; a rule that never
	// returns is one of the few failures the lint host cannot recover from.
	var (
		patternIndex int
		nameIndex    int
		starPattern  = -1
		starName     int
	)
	for nameIndex < len(name) {
		switch {
		case patternIndex < len(pattern) && pattern[patternIndex] == '*':
			starPattern = patternIndex
			starName = nameIndex
			patternIndex++
		case patternIndex < len(pattern) &&
			(pattern[patternIndex] == '?' || pattern[patternIndex] == name[nameIndex]):
			patternIndex++
			nameIndex++
		case starPattern >= 0:
			patternIndex = starPattern + 1
			starName++
			nameIndex = starName
		default:
			return false
		}
	}
	for patternIndex < len(pattern) && pattern[patternIndex] == '*' {
		patternIndex++
	}
	return patternIndex == len(pattern)
}
