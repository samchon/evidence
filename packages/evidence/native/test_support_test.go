package evidence

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimcore "github.com/microsoft/typescript-go/shim/core"
	shimparser "github.com/microsoft/typescript-go/shim/parser"

	"github.com/samchon/ttsc/packages/lint/rule"
)

type capturedProjectReporter struct {
	messages []string
	failed   bool
	state    any
}

func (reporter *capturedProjectReporter) Fail() {
	reporter.failed = true
}

func (reporter *capturedProjectReporter) Report(message string) {
	reporter.failed = true
	reporter.messages = append(reporter.messages, message)
}

func (reporter *capturedProjectReporter) SetState(state any) {
	reporter.state = state
}

func runIndexRule(
	t *testing.T,
	files map[string]string,
	config string,
) []string {
	t.Helper()
	root := t.TempDir()
	paths := make([]string, 0, len(files))
	for path := range files {
		paths = append(paths, path)
	}
	sort.Strings(paths)
	sources := []*shimast.SourceFile{}
	for _, relative := range paths {
		content := files[relative]
		absolute := filepath.Join(root, filepath.FromSlash(relative))
		if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
		if !isTypeScriptTestPath(relative) {
			continue
		}
		normalized := filepath.ToSlash(absolute)
		sources = append(sources, shimparser.ParseSourceFile(
			shimast.SourceFileParseOptions{FileName: normalized},
			content,
			shimcore.ScriptKindTS,
		))
	}
	reporter := &capturedProjectReporter{}
	context := rule.NewProjectContext(
		rule.ProjectIdentity{PhysicalProjectRoot: root},
		sources,
		nil,
		rule.SeverityError,
		json.RawMessage(config),
		reporter,
	)
	indexRule{}.Check(context)
	sort.Strings(reporter.messages)
	return reporter.messages
}

func isTypeScriptTestPath(path string) bool {
	for _, extension := range []string{".ts", ".mts", ".cts"} {
		if strings.HasSuffix(path, extension) {
			return true
		}
	}
	return false
}

func assertNoProblems(t *testing.T, messages []string) {
	t.Helper()
	if len(messages) != 0 {
		t.Fatalf("expected no evidence diagnostics, got:\n%s", strings.Join(messages, "\n"))
	}
}

func assertProblemContains(t *testing.T, messages []string, expected string) {
	t.Helper()
	for _, message := range messages {
		if strings.Contains(message, expected) {
			return
		}
	}
	t.Fatalf(
		"expected one evidence diagnostic containing %q, got:\n%s",
		expected,
		strings.Join(messages, "\n"),
	)
}

func countProblemsContaining(messages []string, expected string) int {
	count := 0
	for _, message := range messages {
		if strings.Contains(message, expected) {
			count++
		}
	}
	return count
}
