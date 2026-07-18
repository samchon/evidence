package evidence

import "testing"

// TestExemptionReasonSurvivesLineWrap pins that a multi-line exemption comment
// is read as a reasoned exemption, not a blank one.
//
// exemptionOf is line-oriented; when the closing --> falls on a later line it
// saw no reason on the marker line and returned blank, so coverage told the
// author "an exemption with no reason" about a reason they plainly wrote. The
// text after the marker on the first line is the reason; only a marker with
// nothing after it is blank.
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
