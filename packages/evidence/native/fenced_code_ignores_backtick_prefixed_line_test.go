package evidence

import "testing"

// TestFencedCodeIgnoresBacktickPrefixedLine pins that a code line beginning with
// the fence character but carrying trailing text does not close the block.
//
// fenceMarker matched the leading backtick run and ignored the rest, so a line
// like ```stop inside a block closed it early: the code after it leaked as
// headings, and the block's real closing fence then re-opened one, dropping
// every heading later in the file. CommonMark closes a fence only with a pure
// run of the fence character.
func TestFencedCodeIgnoresBacktickPrefixedLine(t *testing.T) {
	content := "## Shell Demo\n" +
		"\n" +
		"```bash\n" +
		"echo hi\n" +
		"```stop\n" +
		"# Not Real\n" +
		"done\n" +
		"```\n" +
		"\n" +
		"## After The Block\n"

	got := map[string]bool{}
	for _, section := range scanMarkdownSections(content) {
		got[section.Anchor] = true
	}
	if got["not-real"] {
		t.Fatal("a heading inside a code block leaked as a section (fence closed early)")
	}
	if !got["shell-demo"] {
		t.Fatal("the heading before the block went missing")
	}
	if !got["after-the-block"] {
		t.Fatal("a heading after the block was dropped (fence parity desynced)")
	}
}
