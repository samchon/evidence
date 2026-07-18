package evidence

import "testing"

// TestSlugifyStripsNonASCIIPunctuation pins that anchor derivation matches
// GitHub for headings carrying non-ASCII punctuation, symbols, or emoji.
//
// slugify kept every rune above U+007F, so a curly apostrophe, an em-dash, or an
// emoji leaked into the anchor — minting an id GitHub never renders, so a
// citation copied from the rendered page dangled against a section that exists.
// Non-ASCII letters and digits are still kept, or a non-English heading would be
// unaddressable.
func TestSlugifyStripsNonASCIIPunctuation(t *testing.T) {
	cases := map[string]string{
		"Don’t Repeat Yourself":      "dont-repeat-yourself", // curly apostrophe dropped
		"Cost — Benefit":             "cost--benefit",        // em-dash dropped
		"\U0001F680 Getting Started": "getting-started",      // emoji dropped
		"Café Menu":                  "café-menu",            // non-ASCII letter kept
		"仁義の原則":                      "仁義の原則",                // CJK letters kept
	}
	for title, want := range cases {
		if got := slugify(title); got != want {
			t.Fatalf("slugify(%q) = %q, want %q", title, got, want)
		}
	}
}
