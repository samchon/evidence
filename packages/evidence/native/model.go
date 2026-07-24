package evidence

import (
	"sort"
	"strings"
)

const graphRuleName = "evidence/graph"

const singularRuleName = "evidence/singular"

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
	Index   int
	Type    artifactKind
	Files   globSet
	Source  string
	Symbols symbolSet
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
