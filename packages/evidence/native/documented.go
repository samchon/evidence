package evidence

import (
	"encoding/json"
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"

	"github.com/samchon/ttsc/packages/lint/rule"
)

// documentedRule requires a JSDoc block on every selected export.
//
// Evidence declarations are read from one place only — the JSDoc blocks a node
// reports — so an export without a block is not merely undocumented, it is
// structurally unable to carry a citation. The graph never says so: coverage is
// counted from the evidence side, so an obligation is discharged by whichever
// host does have a block while every undocumented export in the same claim
// contributes nothing and looks exactly like a passing file.
type documentedRule struct{}

type documentedOptions struct {
	Symbol json.RawMessage `json:"symbol"`
}

func (documentedRule) Name() string { return documentedRuleName }

func (documentedRule) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindSourceFile}
}

func (documentedRule) NeedsTypeChecker() bool { return false }

func (documentedRule) VisitsDeclarationFiles() bool { return false }

func (documentedRule) Check(ctx *rule.Context, node *shimast.Node) {
	if ctx == nil || ctx.File == nil || node == nil {
		return
	}
	if node.Kind != shimast.KindSourceFile {
		return
	}
	selected, problems := decodeDocumentedOptions(ctx.Options)
	if len(problems) != 0 {
		for _, problem := range problems {
			ctx.Report(node, problem)
		}
		return
	}
	for _, host := range documentedHosts(ctx.File) {
		if !selected.contains(host.Symbol) {
			continue
		}
		blocks := host.documentation(ctx.File)
		// Every finding anchors on the declaration rather than on a block.
		// `Report` skips a node's leading trivia, and a JSDoc node is entirely
		// trivia to the declaration it precedes, so anchoring there asks the
		// host to underline the range it is built to skip past.
		switch {
		case len(blocks.Content) == 1:
			if blocks.Content[0].Owner == host.Node {
				continue
			}
			ctx.Report(
				host.Node,
				"Misplaced JSDoc on "+host.describe()+
					": the block is at "+describeLines(ctx.File, []*shimast.Node{blocks.Content[0].Block})+
					", but this identity is first declared at line "+
					decimal(identityDeclarationLine(ctx.File, host.Node))+
					". A reader looking for what an identity is should not have to guess which half of a merge carries it. Move the block above the first declaration.",
			)
		case len(blocks.Content) > 1:
			ctx.Report(
				host.Node,
				"Duplicate JSDoc on "+host.describe()+
					": blocks at "+describeLines(ctx.File, blockNodes(blocks.Content))+
					". One identity documents itself in one place — the tag parser reads every block, so a citation split across two of them is provenance a reviewer has to go looking for. Keep one block and fold the rest into it.",
			)
		case len(blocks.Empty) != 0:
			ctx.Report(
				host.Node,
				"Empty JSDoc on "+host.describe()+
					". The block states nothing and carries no tag, so it documents nothing and cites nothing. Describe what this declaration is for, or cite its evidence with '@evidence <target> <reason>'.",
			)
		default:
			ctx.Report(
				host.Node,
				"Missing JSDoc on "+host.describe()+
					". An '@evidence' tag is only ever read from a JSDoc block, so without one this declaration can never cite anything. Add a '/** ... */' block above it.",
			)
		}
	}
}

func init() { rule.Register(documentedRule{}) }

func decodeDocumentedOptions(raw json.RawMessage) (symbolSet, []string) {
	options := documentedOptions{}
	if len(strings.TrimSpace(string(raw))) != 0 {
		if err := json.Unmarshal(raw, &options); err != nil {
			return nil, []string{
				"Invalid evidence/documented configuration: expected an IEvidenceDocumentedConfig object, or a bare severity for the default selection.",
			}
		}
		if problems := rejectUnknownDocumentedFields(raw); len(problems) != 0 {
			return nil, problems
		}
	}
	selected, problems := decodeSymbols(
		options.Symbol,
		artifactTypeScript,
		false,
		"symbol",
	)
	if len(problems) != 0 {
		return nil, problems
	}
	return selected, nil
}

func rejectUnknownDocumentedFields(raw json.RawMessage) []string {
	object, problem := decodeObject(raw, "configuration")
	if problem != "" {
		return []string{
			"Invalid evidence/documented configuration: expected an IEvidenceDocumentedConfig object, or a bare severity for the default selection.",
		}
	}
	return rejectUnknownFields(object, []string{"symbol"}, "configuration")
}

// documentedHost is one public identity that must carry a JSDoc block.
//
// The unit judged is an identity, never a declaration node. Declaration merging
// and overload sets give one identity several nodes — `interface I` beside
// `namespace I`, a callable beside its signatures — and a block on any of them
// documents the identity. Judging the nodes instead would demand a second block
// on the namespace half of the very idiom `evidence/singular` blesses.
type documentedHost struct {
	Node    *shimast.Node
	Nodes   []*shimast.Node
	Symbol  string
	Targets []string
}

// documentationBlocks separates an identity's JSDoc blocks by whether they say
// anything.
//
// Only a block with content documents, and only a block with content can hold
// a citation, so only those are counted against the one-block rule. An empty
// block keeps its own finding rather than pushing an identity into duplicate
// territory for a comment that says nothing.
type documentationBlocks struct {
	Content []documentationBlock
	Empty   []documentationBlock
}

// documentationBlock pairs a block with the declaration it sits above.
//
// The owner is what decides placement: a merged identity is documented at its
// first declaration, so knowing a block exists is not enough — the rule has to
// know which half of the merge it was written on.
type documentationBlock struct {
	Block *shimast.Node
	Owner *shimast.Node
}

// documentation gathers every block that documents this identity.
//
// Gathering across all of the identity's nodes is what makes the count mean
// something: `interface I` beside `namespace I` is one identity with two places
// a block could sit, and the rule is that exactly one of them holds it.
func (host documentedHost) documentation(
	file *shimast.SourceFile,
) documentationBlocks {
	blocks := documentationBlocks{}
	content := file.Text()
	seen := map[int]bool{}
	for _, node := range host.Nodes {
		if node == nil {
			continue
		}
		for _, doc := range node.JSDoc(file) {
			if doc == nil || doc.Pos() < 0 || doc.End() > len(content) {
				continue
			}
			// One block can be reported by several nodes of the same identity,
			// and counting it twice would invent a duplicate out of one comment.
			if seen[doc.Pos()] {
				continue
			}
			seen[doc.Pos()] = true
			if jsdocHasContent(content[doc.Pos():doc.End()]) {
				blocks.Content = append(
					blocks.Content,
					documentationBlock{Block: doc, Owner: node},
				)
				continue
			}
			blocks.Empty = append(
				blocks.Empty,
				documentationBlock{Block: doc, Owner: node},
			)
		}
	}
	return blocks
}

// blockStart points at a block's opening slash rather than at its node start.
//
// A node's position begins where the previous token ended, so it sits in the
// whitespace above the comment and names the blank line before it. Reporting a
// line the reader has to correct by one is worse than reporting none.
func blockStart(content string, node *shimast.Node) int {
	offset := node.Pos()
	if offset < 0 {
		return 0
	}
	for offset < len(content) && strings.ContainsRune(" \t\r\n", rune(content[offset])) {
		offset++
	}
	return offset
}

func blockNodes(blocks []documentationBlock) []*shimast.Node {
	nodes := make([]*shimast.Node, 0, len(blocks))
	for _, block := range blocks {
		nodes = append(nodes, block.Block)
	}
	return nodes
}

// identityDeclarationLine names the line a declaration is written on.
//
// The name's end is preferred over the node's start because a node begins where
// the previous token ended, which for a documented declaration is inside the
// JSDoc block above it.
func identityDeclarationLine(file *shimast.SourceFile, node *shimast.Node) int {
	content := file.Text()
	if name := node.Name(); name != nil && name.End() > 0 {
		return lineAt(content, name.End()-1)
	}
	return lineAt(content, blockStart(content, node))
}

func describeLines(file *shimast.SourceFile, nodes []*shimast.Node) string {
	content := file.Text()
	ordered := append([]*shimast.Node(nil), nodes...)
	sort.Slice(ordered, func(left int, right int) bool {
		return ordered[left].Pos() < ordered[right].Pos()
	})
	lines := make([]string, 0, len(ordered))
	for _, node := range ordered {
		lines = append(lines, "line "+decimal(lineAt(content, blockStart(content, node))))
	}
	if len(lines) < 2 {
		return strings.Join(lines, "")
	}
	return strings.Join(lines[:len(lines)-1], ", ") + " and " + lines[len(lines)-1]
}

func (host documentedHost) describe() string {
	return "exported " + host.Symbol + " '" +
		strings.Join(host.Targets, "', '") + "'"
}

// documentedHosts lists the public identities of a file in source order.
//
// Both the population and its qualified names come from the collector
// `evidence/graph` uses. The population that must be able to hold a tag is by
// definition the population a claim can select as a host, and the name a
// diagnostic asks the author to cite has to be the name the graph resolves — a
// second walk here would let either drift, and the rule would then guarantee
// the wrong set under the wrong names.
func documentedHosts(file *shimast.SourceFile) []documentedHost {
	inventory := &artifactInventory{
		Type:      artifactTypeScript,
		UnitNodes: map[string][]*shimast.Node{},
	}
	collectTypeScriptStatements(
		file.Statements,
		nil,
		"",
		inventory,
		map[*shimast.Node]symbolSet{},
		map[string]*evidenceUnit{},
		file.IsDeclarationFile,
		false,
		false,
	)
	hosts := make([]documentedHost, 0, len(inventory.Units))
	for _, unit := range inventory.Units {
		nodes := inventory.UnitNodes[unit.ID]
		if len(nodes) == 0 {
			continue
		}
		hosts = append(hosts, documentedHost{
			Node:    nodes[0],
			Nodes:   nodes,
			Symbol:  unit.Symbol,
			Targets: []string{unit.Target},
		})
	}
	sort.Slice(hosts, func(left int, right int) bool {
		return hosts[left].Node.Pos() < hosts[right].Node.Pos()
	})
	return orderIdentityDeclarations(
		attachMergedDeclarations(file, mergeSharedBlockHosts(hosts)),
	)
}

// orderIdentityDeclarations puts each identity's declarations in source order.
//
// The collector records them as it walks, and the merged forms are folded in
// afterwards, so the slice arrives in neither order. Placement is defined
// against the declaration that comes first, so that has to be `Node` — and for
// a variable the enclosing statement wins over its binding, which is where
// TypeScript actually attaches the block.
func orderIdentityDeclarations(hosts []documentedHost) []documentedHost {
	for index := range hosts {
		nodes := hosts[index].Nodes
		sort.SliceStable(nodes, func(left int, right int) bool {
			return nodes[left].Pos() < nodes[right].Pos()
		})
		if len(nodes) != 0 {
			hosts[index].Node = nodes[0]
		}
	}
	return hosts
}

// attachMergedDeclarations folds declarations that spell an identity without
// materializing a unit of their own into that identity's host.
//
// Two forms reach the same identity without being units. `export default x`
// declares nothing, and a class or enum declaration is deliberately not a type
// unit — yet each is a second place a block can sit above one name, and
// `evidence/singular` already counts those pairs as one identity. Without this
// the duplicate rule would be blind to the merged forms authors reach for most,
// and a block written on the class half of `class C` / `namespace C` would read
// as no documentation at all.
//
// Only module-scope declarations are folded, which is where every one of these
// forms is written. A namespace nested inside another is left to the qualified
// identity the collector already gives it.
func attachMergedDeclarations(
	file *shimast.SourceFile,
	hosts []documentedHost,
) []documentedHost {
	if file.Statements == nil {
		return hosts
	}
	attach := func(name string, node *shimast.Node) {
		if name == "" {
			return
		}
		for index := range hosts {
			for _, target := range hosts[index].Targets {
				if target != name {
					continue
				}
				hosts[index].Nodes = append(hosts[index].Nodes, node)
				break
			}
		}
	}
	for _, statement := range file.Statements.Nodes {
		if statement == nil {
			continue
		}
		switch statement.Kind {
		case shimast.KindExportAssignment:
			assignment := statement.AsExportAssignment()
			if assignment == nil ||
				assignment.Expression == nil ||
				assignment.Expression.Kind != shimast.KindIdentifier {
				continue
			}
			attach(declarationName(assignment.Expression), statement)
		case shimast.KindClassDeclaration, shimast.KindEnumDeclaration:
			if !isSyntacticallyExported(statement) {
				continue
			}
			attach(declarationName(statement.Name()), statement)
		}
	}
	return hosts
}

// mergeSharedBlockHosts folds identities that can only ever share one block.
//
// `export const a = 1, b = 2;` declares two identities, and TypeScript gives
// the statement a single JSDoc position serving both. They are two obligations
// with one repair, so reporting each separately tells the author the same thing
// twice — the duplication this project's diagnostics deliberately avoid.
func mergeSharedBlockHosts(hosts []documentedHost) []documentedHost {
	merged := make([]documentedHost, 0, len(hosts))
	byStatement := map[*shimast.Node]int{}
	for _, host := range hosts {
		statement := sharedVariableStatement(host)
		if statement == nil {
			merged = append(merged, host)
			continue
		}
		if index, seen := byStatement[statement]; seen &&
			merged[index].Symbol == host.Symbol {
			merged[index].Targets = append(merged[index].Targets, host.Targets...)
			continue
		}
		byStatement[statement] = len(merged)
		merged = append(merged, host)
	}
	return merged
}

func sharedVariableStatement(host documentedHost) *shimast.Node {
	for _, node := range host.Nodes {
		if node != nil && node.Kind == shimast.KindVariableStatement {
			return node
		}
	}
	return nil
}

// jsdocHasContent reports whether a block says anything at all.
//
// Blocks are read through the same accessor the tag collector uses, so the rule
// accepts exactly what a citation could be found in. Accepting anything wider
// would pass a comment the graph cannot read, which is the silence this rule
// exists to remove.
func jsdocHasContent(comment string) bool {
	comment = strings.TrimSpace(comment)
	comment = strings.TrimPrefix(comment, "/**")
	comment = strings.TrimPrefix(comment, "/*")
	comment = strings.TrimSuffix(comment, "*/")
	for _, line := range strings.Split(comment, "\n") {
		line = strings.TrimSpace(line)
		line = strings.TrimSpace(strings.TrimPrefix(line, "*"))
		if line != "" {
			return true
		}
	}
	return false
}
