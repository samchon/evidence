package evidence

import "testing"

// Verifies that a multi-line exemption comment is read as a reasoned exemption,
// not a blank one.
//
// exemptionOf is line-oriented; when the closing --> falls on a later line it
// saw no reason on the marker line and returned blank, so coverage told the
// author "an exemption with no reason" about a reason they plainly wrote. The
// text after the marker on the first line is the reason; only a marker with
// nothing after it is blank.
//
//  1. Read a reason whose closing marker wrapped onto the next line.
//  2. Distinguish it from a genuinely blank marker.
//  3. Confirm the single-line form still parses unchanged.
func TestExemptionReasonSurvivesLineWrap(t *testing.T) {
	reason, blank, found := exemptionOf("<!-- evidence-exempt: descriptive, not a behavior")
	if !found {
		t.Fatal("a wrapped exemption marker must still be recognized")
	}
	if blank || reason != "descriptive, not a behavior" {
		t.Fatalf("reason lost on line wrap: reason=%q blank=%v", reason, blank)
	}

	// A marker with genuinely nothing after it is still blank.
	_, blank, found = exemptionOf("<!-- evidence-exempt:")
	if !found || !blank {
		t.Fatalf("a marker with no reason must read as blank: blank=%v found=%v", blank, found)
	}

	// The single-line form still parses its reason intact.
	reason, blank, found = exemptionOf("<!-- evidence-exempt: descriptive -->")
	if !found || blank || reason != "descriptive" {
		t.Fatalf("single-line exemption regressed: reason=%q blank=%v found=%v", reason, blank, found)
	}
}

// Verifies that an exemption reason may start on the line after its marker
// without exposing comment content as markdown.
//
// Reading only the marker line still labels this form blank, and resuming the
// normal scanner on the next line lets a reason beginning with `#` become a
// phantom section. The exemption comment must stay active until `-->`.
//
//  1. Start an exemption comment with no first-line reason.
//  2. Put a heading-shaped reason on the next line and then close the comment.
//  3. Assert the reason exempts its section and never becomes a section itself.
func TestExemptionReasonMayStartAfterLineWrap(t *testing.T) {
	content := "## Design Note\n" +
		"\n" +
		"<!-- evidence-exempt:\n" +
		"# descriptive, not a behavior\n" +
		"-->\n" +
		"\n" +
		"## After The Comment\n"

	sections := scanMarkdownSections(content)
	if len(sections) != 2 {
		t.Fatalf("comment content became a section: %+v", sections)
	}
	if sections[0].ExemptionBlank ||
		sections[0].Exemption != "# descriptive, not a behavior" {
		t.Fatalf("wrapped reason was not attached: %+v", sections[0])
	}
	if sections[1].Anchor != "after-the-comment" {
		t.Fatalf("heading scanning did not resume after the comment: %+v", sections[1])
	}
}
