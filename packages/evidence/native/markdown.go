package evidence

import (
	"strings"
	"unicode"
)

// documentSection is one addressable node of the evidence graph: a heading in a
// markdown document, reachable as `<path>#<anchor>`.
type documentSection struct {
	// Anchor is the identity. Prose is free to change; this is not.
	Anchor string
	// Title is the heading text as written, carried for diagnostics only. Never
	// compare against it — see the evidence-graph skill.
	Title string
	// Line is 1-based, for a diagnostic that can point a reader at the heading.
	Line int
	// Explicit records whether the anchor came from a `{#id}` annotation rather
	// than being derived from Title. An explicit anchor survives an edit to the
	// heading text; a derived one does not.
	Explicit bool
	// Exemption is the stated reason this section needs no citation, or "" when
	// it is not exempt.
	//
	// There is no separate "is exempt" flag on purpose. An exemption IS its
	// reason: a blank reason is not a reason, and letting one through converts
	// a decision somebody made into a hole nobody has to defend.
	Exemption string
	// ExemptionBlank marks an exemption marker written with no reason, so the
	// scan can tell "not exempt" from "tried to exempt and said nothing".
	ExemptionBlank bool
}

// Exempt reports whether this section is excused from needing a citation.
func (section documentSection) Exempt() bool {
	return section.Exemption != ""
}

// scanMarkdownSections extracts every ATX heading from a markdown document.
//
// Two things this deliberately does NOT do:
//
// It does not parse markdown. A full AST buys nothing here — headings are the
// only construct that matters, and a line-oriented scan cannot be broken by an
// unsupported extension in the rest of the document.
//
// It does not treat Setext headings (underlined with === or ---) as sections.
// They cannot carry an explicit `{#id}`, so every reference to one would be
// hostage to its prose. Supporting them would silently hand users the fragile
// half of the design.
// exemptionMarker excuses the section it appears under from needing a citation.
//
// It is an HTML comment so it stays invisible in every renderer while remaining
// plain text in the source — the exemption is a decision for reviewers of the
// document, not a note for its readers.
//
// A lint disable comment on the citing side would be the cheaper mechanism and
// is the wrong one: it lives in TypeScript while the uncited thing is a section,
// it is invisible to the graph so nobody can ask how many exemptions a
// repository carries, it suppresses every future diagnostic on that node rather
// than this one question, and it demands no reason.
const exemptionMarker = "<!-- evidence-exempt:"

func scanMarkdownSections(content string) []documentSection {
	sections := []documentSection{}
	fence := ""
	for index, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimRight(line, "\r")

		if reason, blank, found := exemptionOf(trimmed); found && fence == "" {
			// The marker excuses the section it sits under, so it attaches to
			// the most recent heading. One before any heading is inert rather
			// than an error: a document-level note is a reasonable thing to
			// write, and refusing it would be pedantry.
			if len(sections) > 0 {
				sections[len(sections)-1].Exemption = reason
				sections[len(sections)-1].ExemptionBlank = blank
			}
			continue
		}

		// A fenced code block can hold anything, including `# not a heading`.
		// Tracking the fence is what keeps a README's own examples out of the
		// graph.
		if fence == "" {
			if marker := fenceMarker(trimmed); marker != "" {
				fence = marker
				continue
			}
		} else {
			// Inside a code block. Only a pure fence run of the same character,
			// at least as long as the opener, closes it — CommonMark forbids
			// trailing text on a closing fence, so a code line that merely begins
			// with the fence character (```stop) does not close the block.
			// Honoring it would leak the code after it as headings and then
			// desync every fence that follows.
			if closesFence(trimmed, fence) {
				fence = ""
			}
			continue
		}

		title, ok := atxHeadingText(trimmed)
		if !ok {
			continue
		}
		anchor, explicit := headingAnchor(title)
		if anchor == "" {
			// A heading of only punctuation or emoji slugs to nothing. It is
			// unaddressable rather than erroneous, so it is not a section.
			continue
		}
		sections = append(sections, documentSection{
			Anchor:   anchor,
			Title:    strings.TrimSpace(stripExplicitAnchor(title)),
			Line:     index + 1,
			Explicit: explicit,
		})
	}
	return sections
}

// exemptionOf reads an `<!-- evidence-exempt: reason -->` marker.
//
// Returns found=true even when the reason is blank, so the caller can report
// the attempt rather than silently treating it as no marker at all. Someone who
// wrote the marker meant to exempt something, and swallowing that intent would
// leave them staring at an error they thought they had addressed.
func exemptionOf(line string) (reason string, blank bool, found bool) {
	trimmed := strings.TrimSpace(line)
	if !strings.HasPrefix(trimmed, exemptionMarker) {
		return "", false, false
	}
	rest := strings.TrimPrefix(trimmed, exemptionMarker)
	end := strings.Index(rest, "-->")
	if end == -1 {
		// The comment does not close on this line — a multi-line exemption. The
		// text present after the marker is a real reason; reporting it as blank
		// would tell the author they wrote nothing when they wrote something, the
		// exact "staring at an error they think they fixed" failure the design
		// warns against. A marker alone with nothing after it is still blank.
		reason = strings.TrimSpace(rest)
		return reason, reason == "", true
	}
	reason = strings.TrimSpace(rest[:end])
	return reason, reason == "", true
}

// fenceMarker returns the fence run that OPENS a code block, or "". An opening
// fence is a run of three or more backticks or tildes; it may carry an info
// string after the run (```ts), so trailing text is ignored here. Closing is a
// stricter test — see closesFence.
func fenceMarker(line string) string {
	trimmed := strings.TrimLeft(line, " ")
	for _, char := range []byte{'`', '~'} {
		count := 0
		for count < len(trimmed) && trimmed[count] == char {
			count++
		}
		if count >= 3 {
			return trimmed[:count]
		}
	}
	return ""
}

// closesFence reports whether line closes a code block opened with `fence`.
//
// CommonMark closes a fence only with a run of the SAME character as the opener,
// at least as long, with nothing after it but optional whitespace. That last
// clause is why fenceMarker cannot be reused: a code line like ```stop starts
// with a fence run but is content, not a close. Treating it as a close would end
// the block early, leak the code after it as headings, and flip fence parity so
// every real heading later in the file is dropped.
func closesFence(line, fence string) bool {
	trimmed := strings.TrimRight(strings.TrimLeft(line, " "), " \t")
	if len(trimmed) < len(fence) {
		return false
	}
	for i := 0; i < len(trimmed); i++ {
		if trimmed[i] != fence[0] {
			return false
		}
	}
	return true
}

// atxHeadingText returns the text of an ATX heading (`# Title`), with any
// closing sequence (`## Title ##`) removed.
func atxHeadingText(line string) (string, bool) {
	trimmed := strings.TrimLeft(line, " ")
	// Four spaces of indent makes an indented code block, not a heading.
	if len(line)-len(trimmed) >= 4 {
		return "", false
	}
	level := 0
	for level < len(trimmed) && trimmed[level] == '#' {
		level++
	}
	if level == 0 || level > 6 {
		return "", false
	}
	rest := trimmed[level:]
	if rest != "" && rest[0] != ' ' && rest[0] != '\t' {
		// `#hashtag` is prose, not a heading.
		return "", false
	}
	rest = strings.TrimSpace(rest)
	rest = strings.TrimRight(rest, "#")
	return strings.TrimSpace(rest), true
}

// headingAnchor derives a heading's anchor, preferring an explicit `{#id}`.
//
// The explicit form exists because anchor identity must be able to outlive the
// prose. An anchor derived from heading text turns every editorial fix into a
// broken reference, which teaches authors that the graph is a tax on writing.
// The derived form exists because requiring an annotation on every heading is a
// tax of its own. Authors pick per heading: annotate what is cited, leave the
// rest alone.
func headingAnchor(title string) (string, bool) {
	if explicit := explicitAnchor(title); explicit != "" {
		return explicit, true
	}
	return slugify(stripExplicitAnchor(title)), false
}

// explicitAnchor reads a trailing `{#id}` annotation, the kramdown/pandoc form
// that GitHub, Docusaurus, and most static site generators already honor.
func explicitAnchor(title string) string {
	trimmed := strings.TrimSpace(title)
	if !strings.HasSuffix(trimmed, "}") {
		return ""
	}
	open := strings.LastIndex(trimmed, "{#")
	if open == -1 {
		return ""
	}
	id := trimmed[open+2 : len(trimmed)-1]
	if id == "" || strings.ContainsAny(id, " \t{}#") {
		return ""
	}
	return id
}

func stripExplicitAnchor(title string) string {
	trimmed := strings.TrimSpace(title)
	if explicitAnchor(trimmed) == "" {
		return trimmed
	}
	return strings.TrimSpace(trimmed[:strings.LastIndex(trimmed, "{#")])
}

// slugify derives a GitHub-compatible anchor from heading text: lowercase,
// drop everything that is not a letter, digit, space, hyphen, or underscore,
// then turn runs of spaces into single hyphens.
//
// Compatibility with GitHub matters more than elegance. A reader who clicks a
// heading in the rendered document and pastes the fragment must land on a
// working reference, or the two addressing schemes drift and the tool feels
// broken even when it is right.
func slugify(title string) string {
	var builder strings.Builder
	for _, char := range strings.ToLower(strings.TrimSpace(title)) {
		switch {
		case char >= 'a' && char <= 'z',
			char >= '0' && char <= '9',
			char == '-',
			char == '_':
			builder.WriteRune(char)
		case char == ' ':
			builder.WriteByte('-')
		case char > 127 && (unicode.IsLetter(char) || unicode.IsNumber(char)):
			// Keep non-ASCII letters and digits — GitHub's slugger keeps them, so
			// a heading in a non-English document stays addressable. Non-ASCII
			// punctuation and symbols are dropped, which GitHub also does: a curly
			// apostrophe, an em-dash, or an emoji left in would mint an anchor the
			// rendered page never produces, so a citation copied from GitHub would
			// dangle against a section that plainly exists.
			builder.WriteRune(char)
		}
	}
	return strings.Trim(builder.String(), "-")
}
