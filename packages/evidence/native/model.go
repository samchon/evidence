package evidence

import (
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

const graphRuleName = "evidence/graph"

const singularRuleName = "evidence/singular"

const documentedRuleName = "evidence/documented"

type artifactKind string

const (
	artifactMarkdown   artifactKind = "markdown"
	artifactSwagger    artifactKind = "swagger"
	artifactTypeScript artifactKind = "typescript"
)

type tagKind string

const (
	tagEvidence tagKind = "evidence"
	tagExclude  tagKind = "evidenceExclude"
)

type graphConfig struct {
	Claims []claimSpec
}

type claimSpec struct {
	Index      int
	Type       artifactKind
	Name       string
	Files      globSet
	Symbols    symbolSet
	References []referenceSpec
}

type referenceSpec struct {
	Index  int
	Type   artifactKind
	Files  globSet
	Source string
	// Entry names a module whose public export graph defines the population.
	// Reachability from it decides membership; identity still belongs to the
	// file that declares the symbol.
	Entry string
	// Package moves the base that Entry and Files resolve against from the
	// project to an installed package, so the two selections compose rather
	// than competing.
	Package string
	Symbols symbolSet
}

// entrySelected reports whether this reference materializes by traversal.
func (reference referenceSpec) entrySelected() bool {
	return reference.Entry != "" || (reference.Package != "" && len(reference.Files.Patterns) == 0)
}

type symbolSet map[string]bool

func (set symbolSet) contains(symbol string) bool {
	return set[symbol]
}

func (set symbolSet) intersects(other symbolSet) bool {
	for symbol := range set {
		if other[symbol] {
			return true
		}
	}
	return false
}

func (set symbolSet) names() string {
	order := []string{"file", "h1", "h2", "h3", "h4", "operation", "type", "function", "property"}
	names := make([]string, 0, len(set))
	known := map[string]bool{}
	for _, name := range order {
		known[name] = true
		if set[name] {
			names = append(names, name)
		}
	}
	other := []string{}
	for name := range set {
		if !known[name] {
			other = append(other, name)
		}
	}
	sort.Strings(other)
	names = append(names, other...)
	return strings.Join(names, ", ")
}

type evidenceUnit struct {
	ID       string
	ParentID string
	Target   string
	// Identity is Target before joining, kept so an entry-relative address can
	// be rebuilt segment by segment. Rewriting the joined string instead would
	// let a literal dot inside a name collapse into qualification.
	Identity []string
	// Aliases are the additional addresses this unit answers to when an entry
	// exposes it by more than one path. They resolve to this same unit, so a
	// symbol reachable twice is still one obligation acknowledged once.
	Aliases  []string
	Type     artifactKind
	Symbol   string
	Path     string
	Line     int
	Readable string
}

func (unit *evidenceUnit) location() string {
	if unit.Line <= 0 {
		return unit.Path
	}
	return unit.Path + ":" + decimal(unit.Line)
}

type evidenceDeclaration struct {
	ID       string
	Type     artifactKind
	Tag      tagKind
	Target   string
	Reason   string
	Hosts    symbolSet
	Path     string
	Line     int
	Sequence int
}

func (declaration *evidenceDeclaration) location() string {
	return declaration.Path + ":" + decimal(declaration.Line)
}

func (declaration *evidenceDeclaration) valid() bool {
	return declaration.Target != "" && declaration.Reason != ""
}

type artifactInventory struct {
	Path         string
	Type         artifactKind
	Units        []*evidenceUnit
	Declarations []*evidenceDeclaration
	Problems     []inventoryProblem
	// Imports indexes the local names a TypeScript module brings into scope, so
	// an inline-link target can be resolved the way TypeScript resolves a name:
	// from the citing file's own bindings rather than from a global table.
	Imports map[string]importBinding
	// Exports is the module's public surface as importers see it, which is what
	// an entry traversal follows. It records reachability only; a re-export
	// still creates no unit of its own.
	Exports []moduleExport
	// UnitNodes maps a unit ID to every declaration node that spells it.
	//
	// A unit is an identity, not a declaration: declaration merging and overload
	// sets give one identity several nodes. Which of them a rule then cares
	// about is the rule's own business — this records only that they belong to
	// one identity. Left nil when a caller has no use for the association, which
	// keeps the graph's own scan allocating nothing extra.
	UnitNodes map[string][]*shimast.Node
}

func (inventory *artifactInventory) recordUnitNode(id string, node *shimast.Node) {
	if inventory == nil || inventory.UnitNodes == nil || node == nil {
		return
	}
	inventory.UnitNodes[id] = append(inventory.UnitNodes[id], node)
}

type inventoryProblem struct {
	Symbol  string
	Message string
}

type claimState struct {
	Spec         claimSpec
	Paths        []string
	Declarations []*evidenceDeclaration
	References   []referenceState
}

type referenceState struct {
	Spec         referenceSpec
	Paths        []string
	Units        []*evidenceUnit
	Scopes       []*evidenceUnit
	UnitsByScope map[string][]*evidenceUnit
}

func decimal(value int) string {
	if value == 0 {
		return "0"
	}
	negative := value < 0
	if negative {
		value = -value
	}
	digits := make([]byte, 0, 12)
	for value > 0 {
		digits = append([]byte{byte('0' + value%10)}, digits...)
		value /= 10
	}
	if negative {
		return "-" + string(digits)
	}
	return string(digits)
}
