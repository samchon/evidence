package evidence

import (
	"encoding/json"
	"strings"
	"testing"
)

/**
 * Verifies configuration defaults: each artifact role receives the symbol set
 * documented by the public TypeScript interfaces.
 *
 * Defaults differ by both artifact and role. Reusing one generic fallback would
 * silently turn TypeScript functions into source evidence or silently reject
 * valid citer hosts, so this test reads the decoded model directly.
 *
 *  1. Omit every source and citer symbol selector.
 *  2. Decode one Markdown source and one TypeScript source.
 *  3. Assert the four documented default sets independently.
 */
func TestConfigurationDefaultsFollowPublicContract(t *testing.T) {
	config, problems := decodeGraphConfig(json.RawMessage(`{
		"sources": [
			{
				"type": "markdown",
				"files": ["docs/**"],
				"citedBy": {"type": "typescript", "files": ["src/**"]}
			},
			{
				"type": "typescript",
				"files": ["src/**"],
				"citedBy": {"type": "markdown", "files": ["docs/**"]}
			}
		]
	}`))
	if len(problems) != 0 {
		t.Fatalf("unexpected decode diagnostics: %v", problems)
	}
	if got := config.Sources[0].Symbols.names(); got != "file, h1, h2, h3, h4" {
		t.Fatalf("Markdown source default = %q", got)
	}
	if got := config.Sources[0].CitedBy[0].Symbols.names(); got != "type, function, property" {
		t.Fatalf("TypeScript citer default = %q", got)
	}
	if got := config.Sources[1].Symbols.names(); got != "type" {
		t.Fatalf("TypeScript source default = %q", got)
	}
	if got := config.Sources[1].CitedBy[0].Symbols.names(); got != "file, h1, h2, h3, h4" {
		t.Fatalf("Markdown citer default = %q", got)
	}
}

/**
 * Verifies singular-or-array configuration: symbol arrays form a union while
 * citer arrays remain independently indexed groups.
 *
 * The two array shapes look alike in JSON but carry opposite graph semantics.
 * Pinning the decoded shape prevents a refactor from flattening citer
 * groups into one pooled population.
 *
 *  1. Configure one symbol string, one symbol array, and two citers.
 *  2. Decode the public configuration.
 *  3. Assert symbol union and citer group boundaries survive.
 */
func TestConfigurationKeepsSymbolUnionAndCiterGroupsDistinct(t *testing.T) {
	config, problems := decodeGraphConfig(json.RawMessage(`{
		"sources": [{
			"type": "typescript",
			"files": ["src/**"],
			"symbol": ["function", "property"],
			"citedBy": [
				{"type": "markdown", "files": ["docs/a/**"], "symbol": "h2"},
				{"type": "markdown", "files": ["docs/b/**"], "symbol": ["file", "h1"]}
			]
		}]
	}`))
	if len(problems) != 0 {
		t.Fatalf("unexpected decode diagnostics: %v", problems)
	}
	source := config.Sources[0]
	if got := source.Symbols.names(); got != "function, property" {
		t.Fatalf("symbol array did not form one union: %q", got)
	}
	if len(source.CitedBy) != 2 {
		t.Fatalf("citer array collapsed to %d group(s)", len(source.CitedBy))
	}
	if source.CitedBy[0].Symbols.names() != "h2" ||
		source.CitedBy[1].Symbols.names() != "file, h1" {
		t.Fatalf("citer selectors crossed group boundaries: %+v", source.CitedBy)
	}
}

/**
 * Verifies invalid configuration diagnostics: obsolete nested severity and
 * empty obligation arrays fail before graph evaluation.
 *
 * The public contract leaves severity to the outer lint tuple and requires a
 * real population. Accepting old fields or vacuous arrays would preserve the
 * superseded model as a silent compatibility path.
 *
 *  1. Decode a source with nested severity and an empty citedBy array.
 *  2. Decode an empty source array separately.
 *  3. Assert every failure names the public repair boundary.
 */
func TestConfigurationRejectsObsoleteAndVacuousShapes(t *testing.T) {
	_, problems := decodeGraphConfig(json.RawMessage(`{
		"sources": [{
			"type": "markdown",
			"files": ["docs/**"],
			"severity": "error",
			"citedBy": []
		}]
	}`))
	joined := strings.Join(problems, "\n")
	if !strings.Contains(joined, "severity belongs only in the outer") {
		t.Fatalf("nested severity was not rejected: %s", joined)
	}
	if !strings.Contains(joined, "empty citedBy array") {
		t.Fatalf("empty citers were not rejected: %s", joined)
	}

	_, problems = decodeGraphConfig(json.RawMessage(`{"sources":[]}`))
	if !strings.Contains(strings.Join(problems, "\n"), "at least one source") {
		t.Fatalf("empty sources were not rejected: %v", problems)
	}
}

/**
 * Verifies malformed runtime JSON cannot slip past the stricter public
 * configuration boundary.
 *
 * TypeScript catches these shapes for typed consumers, but lint configuration
 * is runtime input and may be JavaScript, generated JSON, or an unchecked cast.
 * Every required discriminator and non-empty selector therefore needs its own
 * actionable decoder failure.
 *
 *  1. Exercise missing, unknown, unsupported, empty, and absolute-path shapes.
 *  2. Decode each shape without graph evaluation.
 *  3. Assert the diagnostic names the violated public boundary.
 */
func TestConfigurationRejectsMalformedPublicBoundaries(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want string
	}{
		{
			name: "missing options",
			raw:  "",
			want: "requires an IEvidenceGraphConfig options object",
		},
		{
			name: "non-object root",
			raw:  "[]",
			want: "configuration: expected an object",
		},
		{
			name: "unsupported discriminator",
			raw: `{"sources":[{
				"type":"prisma",
				"files":["schema.prisma"],
				"citedBy":{"type":"markdown","files":["docs/**"]}
			}]}`,
			want: "unsupported artifact type 'prisma'",
		},
		{
			name: "missing files",
			raw: `{"sources":[{
				"type":"markdown",
				"citedBy":{"type":"typescript","files":["src/**"]}
			}]}`,
			want: "required project-relative glob array is missing",
		},
		{
			name: "empty files",
			raw: `{"sources":[{
				"type":"markdown",
				"files":[],
				"citedBy":{"type":"typescript","files":["src/**"]}
			}]}`,
			want: "at least one positive glob is required",
		},
		{
			name: "exclusions only",
			raw: `{"sources":[{
				"type":"markdown",
				"files":["!docs/private/**"],
				"citedBy":{"type":"typescript","files":["src/**"]}
			}]}`,
			want: "files array must contain at least one positive glob",
		},
		{
			name: "absolute files",
			raw: `{"sources":[{
				"type":"markdown",
				"files":["/docs/spec.md"],
				"citedBy":{"type":"typescript","files":["src/**"]}
			}]}`,
			want: "every files pattern must be project-relative",
		},
		{
			name: "empty symbols",
			raw: `{"sources":[{
				"type":"markdown",
				"files":["docs/**"],
				"symbol":[],
				"citedBy":{"type":"typescript","files":["src/**"]}
			}]}`,
			want: "empty symbol array selects no evidence units",
		},
		{
			name: "missing citer",
			raw: `{"sources":[{
				"type":"markdown",
				"files":["docs/**"]
			}]}`,
			want: "required citedBy group is missing",
		},
		{
			name: "renamed citer property",
			raw: `{"sources":[{
				"type":"markdown",
				"files":["docs/**"],
				"reference":{"type":"typescript","files":["src/**"]}
			}]}`,
			want: "renamed; declare the citer groups under 'citedBy'",
		},
		{
			name: "unknown source property",
			raw: `{"sources":[{
				"type":"markdown",
				"files":["docs/**"],
				"documents":["legacy"],
				"citedBy":{"type":"typescript","files":["src/**"]}
			}]}`,
			want: "sources[0].documents: unknown property",
		},
	}
	for _, entry := range cases {
		t.Run(entry.name, func(t *testing.T) {
			_, problems := decodeGraphConfig(json.RawMessage(entry.raw))
			if !strings.Contains(strings.Join(problems, "\n"), entry.want) {
				t.Fatalf("expected %q, got %v", entry.want, problems)
			}
		})
	}
}
