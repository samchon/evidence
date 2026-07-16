package evidence

import "testing"

// TestMarkdownAnchorsSurviveProseEdits pins section identity.
//
// The evidence-graph skill requires that prose stay free while the anchor stays
// contractual, so an explicit `{#id}` must win over the derived slug and must
// not leak into the recorded title. It also pins the fenced-code exclusion:
// without it a README's own `# Example` block becomes a citable section, and
// the graph starts resolving references to documentation about itself.
//
//  1. An explicit anchor is used verbatim and stripped from the title.
//  2. A derived anchor matches GitHub's slug, so a pasted fragment resolves.
//  3. Headings inside fenced code blocks are not sections.
func TestMarkdownAnchorsSurviveProseEdits(t *testing.T) {
	content := "# Shopping Sale Spec\n" +
		"\n" +
		"## Pricing & Discounts {#pricing}\n" +
		"\n" +
		"Some prose.\n" +
		"\n" +
		"```md\n" +
		"# Not A Heading\n" +
		"```\n" +
		"\n" +
		"### Order Placement\n" +
		"\n" +
		"#hashtag is prose\n" +
		"\n" +
		"####### Seven hashes is not a heading\n"

	sections := scanMarkdownSections(content)
	if len(sections) != 3 {
		t.Fatalf("expected 3 sections, got %d: %+v", len(sections), sections)
	}

	if got, want := sections[0].Anchor, "shopping-sale-spec"; got != want {
		t.Errorf("derived anchor = %q, want %q", got, want)
	}

	// The explicit anchor is the whole point: renaming this heading must not
	// break a citation.
	explicit := sections[1]
	if got, want := explicit.Anchor, "pricing"; got != want {
		t.Errorf("explicit anchor = %q, want %q", got, want)
	}
	if !explicit.Explicit {
		t.Error("explicit anchor must be reported as explicit")
	}
	if got, want := explicit.Title, "Pricing & Discounts"; got != want {
		t.Errorf("title = %q, want %q — the {#id} must not leak in", got, want)
	}

	// A derived anchor must equal GitHub's slug, or a fragment copied from the
	// rendered page fails to resolve and the tool looks broken while being
	// right.
	if got, want := sections[2].Anchor, "order-placement"; got != want {
		t.Errorf("derived anchor = %q, want %q", got, want)
	}

	for _, section := range sections {
		if section.Title == "Not A Heading" {
			t.Error("a heading inside a fenced code block must not be a section")
		}
	}
}

// TestMarkdownAnchorKeepsNonAsciiHeadings pins the negative twin of slugify's
// character filter.
//
// Dropping non-ASCII would make every heading in a Korean or Japanese document
// unaddressable while still producing a plausible-looking empty-ish anchor, so
// the failure would surface as a confusing "section not found" rather than as
// an obvious defect.
//
//  1. A Korean heading slugs to its own text.
//  2. A punctuation-only heading yields no section at all.
func TestMarkdownAnchorKeepsNonAsciiHeadings(t *testing.T) {
	sections := scanMarkdownSections("# 가격 정책\n\n## ***\n")
	if len(sections) != 1 {
		t.Fatalf("expected 1 section, got %d: %+v", len(sections), sections)
	}
	if got, want := sections[0].Anchor, "가격-정책"; got != want {
		t.Errorf("anchor = %q, want %q", got, want)
	}
}
