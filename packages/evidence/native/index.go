package evidence

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"

	"github.com/samchon/ttsc/packages/lint/rule"
)

// indexRuleName is the project rule every file rule gates on.
const indexRuleName = "evidence/index"

// evidenceIndex is the identity source for every reference.
//
// It is built once per Program by the project rule below and read by file rules
// through Context.ProjectResult. It must be treated as IMMUTABLE after
// construction: the host synchronizes the state wrapper but not its contents,
// and file rules read it from a parallel walk.
type evidenceIndex struct {
	// Documents maps a project-relative slash path to its sections.
	Documents map[string][]documentSection
	// Symbols is the set of qualified declaration names in the Program.
	Symbols map[string]bool
	// DocumentPatterns records what was scanned, so a diagnostic can tell an
	// author their document is simply not covered rather than missing.
	DocumentPatterns []string
	// Root is the resolved project root.
	//
	// It is published here because rule.Context carries no ProjectIdentity —
	// only a project rule receives one. A file rule that needs to match its own
	// path against a folder glob has no other way to learn what the path is
	// relative to.
	Root string
}

// relativePath converts an absolute source path into the project-relative,
// slash-separated form that folder globs are written against.
//
// The second return is false when the path escapes the root, and the caller
// must then stay silent rather than guess. The host relativizes its own `files:`
// globs through an unexported helper that resolves symlinks and Windows 8.3
// short names on both sides first; this package cannot reach that helper, so a
// junction or short-name ancestor makes a plain Rel disagree with the host and
// return a `..`-prefixed path. Matching a glob against that would be nonsense,
// and reporting on it would blame an author for a path they never wrote.
func (index *evidenceIndex) relativePath(absolute string) (string, bool) {
	if index == nil || index.Root == "" || absolute == "" {
		return "", false
	}
	relative, err := filepath.Rel(index.Root, absolute)
	if err != nil {
		return "", false
	}
	normalized := normalizePath(relative)
	if normalized == ".." || strings.HasPrefix(normalized, "../") {
		return "", false
	}
	return normalized, true
}

// anchors returns a document's anchor set, or nil when the path is unknown.
func (index *evidenceIndex) anchors(path string) ([]documentSection, bool) {
	if index == nil {
		return nil, false
	}
	sections, ok := index.Documents[path]
	return sections, ok
}

// hasSymbol reports whether a qualified name was declared in the Program.
func (index *evidenceIndex) hasSymbol(name string) bool {
	if index == nil {
		return false
	}
	return index.Symbols[name]
}

// documentPaths returns the indexed paths in deterministic order, for
// diagnostics that suggest what the author might have meant.
func (index *evidenceIndex) documentPaths() []string {
	paths := make([]string, 0, len(index.Documents))
	for path := range index.Documents {
		paths = append(paths, path)
	}
	sort.Strings(paths)
	return paths
}

type indexOptions struct {
	// Documents are globs of markdown to index, project-relative.
	Documents []string `json:"documents"`
}

// defaultDocumentPatterns indexes every markdown file in the project.
//
// A permissive default is right here: indexing a document nobody cites costs
// one file read, while failing to index a cited one produces a dangling
// reference that looks like the author's mistake.
var defaultDocumentPatterns = []string{"**/*.md"}

// skippedDirectories are never walked. These hold other people's markdown, and
// indexing them would let a reference resolve against a dependency's README.
var skippedDirectories = map[string]bool{
	"node_modules": true,
	".git":         true,
	"lib":          true,
	"dist":         true,
	"coverage":     true,
}

// indexRule builds the document and symbol index once per Program.
//
// It is a project rule for one hard reason: markdown cannot enter a ttsc
// Program at all. The lint host filters source files to the eight TypeScript
// and JavaScript extensions and constrains them to the tsconfig file list, so
// there is no node to hang a markdown finding on and no file rule that would
// ever be dispatched for a `.md` file. A project rule runs once per Program
// with no such dispatch, and Go can read the filesystem directly, so the index
// is built here and published for file rules to read.
type indexRule struct{}

func (indexRule) Name() string { return indexRuleName }

// NeedsTypeChecker is false because this rule reads markdown from disk and
// walks ctx.Sources syntactically. It never touches ctx.Checker.
//
// The marker does nothing on @ttsc/lint 0.19.1, where a declared project rule
// sets the engine-wide checker flag unconditionally and so serializes the file
// walk for every rule in the run. It is declared anyway: it is true, it costs
// nothing, and it becomes effective the moment the host honors it. See
// samchon/ttsc feat/lint-project-rule-checker-opt-out.
func (indexRule) NeedsTypeChecker() bool { return false }

func (indexRule) Check(ctx *rule.ProjectContext) {
	if ctx == nil {
		return
	}
	var options indexOptions
	_ = ctx.DecodeOptions(&options)
	patterns := options.Documents
	if len(patterns) == 0 {
		patterns = defaultDocumentPatterns
	}

	root := projectRoot(ctx.Identity)
	if root == "" {
		// Without a root, every relative path is a guess. Publishing an empty
		// index would make every reference dangle and blame the author for a
		// host-side gap, so publish nothing and let the gate hold the file
		// rules silent.
		ctx.Report(
			"Evidence index could not resolve the project root, so no document " +
				"was indexed and every evidence rule stayed silent. This is a host " +
				"integration gap rather than a source defect.",
		)
		return
	}

	index := buildEvidenceIndex(root, patterns, ctx.Sources)
	reportAmbiguousAnchors(ctx, index)

	// Published even when empty. Presence is the signal, not length: an index
	// that exists proves the scan ran, which is exactly what a file rule needs
	// to know before it dares to report a dangling reference.
	ctx.SetState(index)
}

// buildEvidenceIndex scans the project's markdown and symbols.
//
// It is shared rather than owned by the index rule because project rules cannot
// read one another's state — ProjectResultReader hangs off the file-rule
// Context only. `evidence/coverage` is therefore a project rule that must build
// its own view, and the folder-to-node mapping must live in one function or the
// two rules drift apart. That drift is exactly the duplicated-formula problem
// this plugin exists to avoid, so the cost paid here is deliberate: the
// markdown is scanned once per project rule rather than once per Program.
// Duplicated work is recoverable; duplicated logic is not.
func buildEvidenceIndex(
	root string,
	patterns []string,
	sources []*shimast.SourceFile,
) *evidenceIndex {
	index := &evidenceIndex{
		Documents:        map[string][]documentSection{},
		Symbols:          map[string]bool{},
		DocumentPatterns: patterns,
		Root:             root,
	}
	collectDocuments(root, patterns, index)
	collectSymbols(sources, index)
	return index
}

// projectRoot prefers the physical root because it is the filesystem identity
// the compiler itself resolved, not the caller's spelling of it.
func projectRoot(identity rule.ProjectIdentity) string {
	for _, candidate := range []string{
		identity.PhysicalProjectRoot,
		identity.LogicalProjectRoot,
		identity.ExplicitProjectRoot,
		identity.InvocationCwd,
	} {
		if candidate != "" {
			return candidate
		}
	}
	return ""
}

// collectDocuments walks the project once and indexes every markdown file
// matching a pattern.
func collectDocuments(root string, patterns []string, index *evidenceIndex) {
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			// An unreadable subtree is not this rule's business to adjudicate;
			// skipping it is better than failing a build over a permission
			// quirk in a directory nobody cites.
			return nil
		}
		if info.IsDir() {
			if skippedDirectories[info.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(strings.ToLower(info.Name()), ".md") {
			return nil
		}
		relative, relErr := filepath.Rel(root, path)
		if relErr != nil {
			return nil
		}
		key := normalizePath(relative)
		if !matchAnyGlob(patterns, key) {
			return nil
		}
		content, readErr := os.ReadFile(path)
		if readErr != nil {
			return nil
		}
		index.Documents[key] = scanMarkdownSections(string(content))
		return nil
	})
}

// reportAmbiguousAnchors fails the index when one document has two sections
// with the same anchor.
//
// Two headings that slug alike make a reference ambiguous, and an ambiguous
// reference silently resolves to whichever came first. GitHub disambiguates by
// suffixing `-1`, but copying that would mean a citation's meaning depends on
// heading ORDER — reorder the document and the citation now points elsewhere,
// with nothing reported. Refusing is the honest option.
func reportAmbiguousAnchors(ctx *rule.ProjectContext, index *evidenceIndex) {
	for _, path := range index.documentPaths() {
		seen := map[string]documentSection{}
		for _, section := range index.Documents[path] {
			previous, clash := seen[section.Anchor]
			if !clash {
				seen[section.Anchor] = section
				continue
			}
			ctx.Report(
				"Ambiguous evidence anchor '" + section.Anchor + "' in " + path +
					": line " + itoa(previous.Line) + " and line " + itoa(section.Line) +
					" resolve to the same anchor, so a citation to it has no single " +
					"meaning. Give one heading an explicit anchor, as in " +
					"'## " + section.Title + " {#" + section.Anchor + "-2}'.",
			)
		}
	}
}

// collectSymbols indexes every declaration name a reference could address,
// including names nested in namespaces so `IShoppingSale.IUpdate` resolves.
func collectSymbols(sources []*shimast.SourceFile, index *evidenceIndex) {
	for _, file := range sources {
		if file == nil {
			continue
		}
		collectSymbolsFromStatements(file.Statements, "", index)
	}
}

func collectSymbolsFromStatements(
	statements *shimast.NodeList,
	prefix string,
	index *evidenceIndex,
) {
	if statements == nil {
		return
	}
	for _, statement := range statements.Nodes {
		collectSymbolsFromStatement(statement, prefix, index)
	}
}

func collectSymbolsFromStatement(
	statement *shimast.Node,
	prefix string,
	index *evidenceIndex,
) {
	if statement == nil {
		return
	}
	switch statement.Kind {
	case shimast.KindInterfaceDeclaration,
		shimast.KindTypeAliasDeclaration,
		shimast.KindClassDeclaration,
		shimast.KindFunctionDeclaration,
		shimast.KindEnumDeclaration:
		addSymbol(index, prefix, shimast.NodeText(statement.Name()))
	case shimast.KindVariableStatement:
		declarations := statement.AsVariableStatement()
		if declarations == nil || declarations.DeclarationList == nil {
			return
		}
		list := declarations.DeclarationList.AsVariableDeclarationList()
		if list == nil || list.Declarations == nil {
			return
		}
		for _, declaration := range list.Declarations.Nodes {
			if declaration == nil {
				continue
			}
			addSymbol(index, prefix, shimast.NodeText(declaration.Name()))
		}
	case shimast.KindModuleDeclaration:
		collectSymbolsFromModule(statement, prefix, index)
	}
}

// collectSymbolsFromModule indexes a namespace and everything it qualifies.
//
// `namespace Outer.Inner {}` is not one node with a dotted name. It parses as
// ModuleDeclaration(Outer) whose Body is ModuleDeclaration(Inner) whose Body is
// the block, so the dotted form must be walked one level at a time, each level
// extending the qualifier.
//
// The Kind check before AsModuleBlock is load-bearing rather than defensive.
// The shim's As* accessors are type assertions: given the wrong node they
// PANIC, they do not return nil. Here that panic took out the whole index rule,
// and since every file rule gates on a resident index, one dotted namespace
// anywhere in a project silently disabled evidence checking everywhere.
func collectSymbolsFromModule(
	statement *shimast.Node,
	prefix string,
	index *evidenceIndex,
) {
	module := statement.AsModuleDeclaration()
	if module == nil {
		return
	}
	name := shimast.NodeText(statement.Name())
	addSymbol(index, prefix, name)
	if module.Body == nil || name == "" {
		return
	}
	qualified := qualify(prefix, name)
	switch module.Body.Kind {
	case shimast.KindModuleBlock:
		body := module.Body.AsModuleBlock()
		if body == nil {
			return
		}
		collectSymbolsFromStatements(body.Statements, qualified, index)
	case shimast.KindModuleDeclaration:
		// The `Outer.Inner` form: recurse, carrying `Outer` as the qualifier.
		collectSymbolsFromModule(module.Body, qualified, index)
	}
}

func addSymbol(index *evidenceIndex, prefix string, name string) {
	if name == "" {
		return
	}
	index.Symbols[qualify(prefix, name)] = true
}

func qualify(prefix string, name string) string {
	if prefix == "" {
		return name
	}
	return prefix + "." + name
}

// itoa avoids pulling strconv in for one call site.
func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	negative := value < 0
	if negative {
		value = -value
	}
	digits := []byte{}
	for value > 0 {
		digits = append([]byte{byte('0' + value%10)}, digits...)
		value /= 10
	}
	if negative {
		return "-" + string(digits)
	}
	return string(digits)
}
