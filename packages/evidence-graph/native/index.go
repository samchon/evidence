package evidence

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/samchon/ttsc/packages/lint/rule"
)

type indexRule struct{}

func (indexRule) Name() string { return indexRuleName }

func (indexRule) NeedsTypeChecker() bool { return false }

func (indexRule) Check(ctx *rule.ProjectContext) {
	if ctx == nil {
		return
	}
	config, problems := decodeGraphConfig(ctx.Options)
	if len(problems) != 0 {
		reportProblems(ctx, problems)
		return
	}
	root := evidenceProjectRoot(ctx.Identity)
	if root == "" {
		ctx.Report("Evidence graph could not resolve the project root. Run ttsc with a project config or explicit project root so project-relative evidence globs have one stable base.")
		return
	}
	info, err := os.Stat(root)
	if err != nil || !info.IsDir() {
		ctx.Report("Evidence graph project root '" + root + "' is not a readable directory. Fix the ttsc project identity before evaluating evidence globs.")
		return
	}

	markdown, markdownProblems := loadMarkdownInventories(root, config)
	typescript := loadTypeScriptInventories(root, ctx.Sources)
	problems = append(problems, markdownProblems...)
	states, stateProblems := materializeSourceStates(config, markdown, typescript)
	problems = append(problems, stateProblems...)
	problems = append(problems, evaluateEvidenceGraph(states)...)
	reportProblems(ctx, problems)
}

func init() {
	rule.RegisterProject(indexRule{})
}

func evidenceProjectRoot(identity rule.ProjectIdentity) string {
	for _, candidate := range []string{
		identity.PhysicalProjectRoot,
		identity.LogicalProjectRoot,
		identity.ExplicitProjectRoot,
		identity.InvocationCwd,
	} {
		if candidate == "" {
			continue
		}
		absolute, err := filepath.Abs(candidate)
		if err == nil {
			return filepath.Clean(absolute)
		}
	}
	return ""
}

func materializeSourceStates(
	config graphConfig,
	markdown map[string]*artifactInventory,
	typescript map[string]*artifactInventory,
) ([]sourceState, []string) {
	states := make([]sourceState, 0, len(config.Sources))
	problems := []string{}
	for _, source := range config.Sources {
		inventories := inventoriesOf(source.Type, markdown, typescript)
		paths := matchingInventoryPaths(inventories, source.Files)
		state := sourceState{
			Spec:     source,
			UnitByID: map[string]*evidenceUnit{},
		}
		if len(paths) == 0 {
			problems = append(
				problems,
				sourceLabel(source)+" matched no "+string(source.Type)+" files for "+describePatterns(source.Files)+". Fix the project-relative globs; '*' stays within one segment, '**' crosses segments, and a bare directory is not recursive.",
			)
		}
		selectedInventoryProblem := false
		for _, path := range paths {
			for _, inventoryProblem := range inventories[path].Problems {
				if inventoryProblem.Symbol == "*" ||
					source.Symbols.contains(inventoryProblem.Symbol) {
					selectedInventoryProblem = true
				}
			}
			for _, unit := range inventories[path].Units {
				if !source.Symbols.contains(unit.Symbol) || state.UnitByID[unit.ID] != nil {
					continue
				}
				state.UnitByID[unit.ID] = unit
				state.Units = append(state.Units, unit)
			}
		}
		sortUnits(state.Units)
		if len(paths) != 0 &&
			len(state.Units) == 0 &&
			!selectedInventoryProblem {
			problems = append(
				problems,
				sourceLabel(source)+" matched "+decimal(len(paths))+" file(s) but materialized no selected evidence units ("+source.Symbols.names()+"). Select symbol kinds present in those files or correct the source globs.",
			)
		}
		for _, citer := range source.CitedBy {
			citerInventories := inventoriesOf(citer.Type, markdown, typescript)
			citerPaths := matchingInventoryPaths(citerInventories, citer.Files)
			citerState := citerState{Spec: citer, Paths: citerPaths}
			if len(citerPaths) == 0 {
				problems = append(
					problems,
					sourceLabel(source)+" "+citerLabel(citer)+" matched no "+string(citer.Type)+" files for "+describePatterns(citer.Files)+". Fix the citer globs; this independent coverage group cannot acknowledge evidence without files.",
				)
			}
			for _, path := range citerPaths {
				citerState.Declarations = append(
					citerState.Declarations,
					citerInventories[path].Declarations...,
				)
			}
			state.Citers = append(state.Citers, citerState)
		}
		states = append(states, state)
	}
	return states, problems
}

func evaluateEvidenceGraph(states []sourceState) []string {
	problems := []string{}
	targets := map[string]map[string]*evidenceUnit{}
	markdownTargets := map[string]map[string]*evidenceUnit{}
	for _, state := range states {
		for _, unit := range state.Units {
			if targets[unit.Target] == nil {
				targets[unit.Target] = map[string]*evidenceUnit{}
			}
			targets[unit.Target][unit.ID] = unit
			if unit.Type == artifactMarkdown {
				if markdownTargets[unit.Target] == nil {
					markdownTargets[unit.Target] = map[string]*evidenceUnit{}
				}
				markdownTargets[unit.Target][unit.ID] = unit
			}
		}
	}

	declarations := map[string]*evidenceDeclaration{}
	for _, state := range states {
		for _, citer := range state.Citers {
			for _, declaration := range citer.Declarations {
				declarations[declaration.ID] = declaration
			}
		}
	}
	declarationIDs := make([]string, 0, len(declarations))
	for id := range declarations {
		declarationIDs = append(declarationIDs, id)
	}
	sort.Strings(declarationIDs)

	resolved := map[string]string{}
	for _, id := range declarationIDs {
		declaration := declarations[id]
		if !declaration.valid() {
			problems = append(
				problems,
				"Malformed @"+string(declaration.Tag)+" declaration at "+declaration.location()+": target and non-empty reason are mandatory. Write '@"+string(declaration.Tag)+" <target> <reason>'.",
			)
			continue
		}
		candidates := declarationCandidates(declaration.Target, targets, markdownTargets)
		switch len(candidates) {
		case 0:
			problems = append(
				problems,
				"Unresolved evidence target '"+declaration.Target+"' at "+declaration.location()+": no configured source materializes that evidence unit. Correct the target or the owning source files/symbol selection.",
			)
		case 1:
			for unitID := range candidates {
				resolved[id] = unitID
			}
		default:
			descriptions := make([]string, 0, len(candidates))
			for _, unit := range candidates {
				descriptions = append(descriptions, unit.Readable+" at "+unit.location())
			}
			sort.Strings(descriptions)
			problems = append(
				problems,
				"Ambiguous evidence target '"+declaration.Target+"' at "+declaration.location()+": it matches "+strings.Join(descriptions, "; ")+". Rename or qualify the source symbols so the target has exactly one meaning.",
			)
		}
	}

	for _, state := range states {
		if len(state.Units) == 0 {
			continue
		}
		for _, citer := range state.Citers {
			if len(citer.Paths) == 0 {
				continue
			}
			acknowledged := map[string]*evidenceDeclaration{}
			for _, declaration := range citer.Declarations {
				unitID := resolved[declaration.ID]
				unit := state.UnitByID[unitID]
				if unit == nil {
					continue
				}
				if !citer.Spec.Symbols.contains(declaration.Host) {
					host := declaration.Host
					if host == "" {
						host = "unsupported or non-exported declaration"
					}
					problems = append(
						problems,
						"Out-of-scope @"+string(declaration.Tag)+" host at "+declaration.location()+" for "+sourceLabel(state.Spec)+" "+citerLabel(citer.Spec)+": host kind '"+host+"' is not selected ("+citer.Spec.Symbols.names()+"). Move the declaration to a selected host or widen this citer group's symbol selector.",
					)
					continue
				}
				if first := acknowledged[unitID]; first != nil {
					problems = append(
						problems,
						"Duplicate acknowledgement for '"+unit.Target+"' in "+sourceLabel(state.Spec)+" "+citerLabel(citer.Spec)+" at "+declaration.location()+"; the first is at "+first.location()+". Keep exactly one @evidence or @evidenceExclude declaration for this evidence unit in this citer group.",
					)
					continue
				}
				acknowledged[unitID] = declaration
			}
			for _, unit := range state.Units {
				if acknowledged[unit.ID] != nil {
					continue
				}
				problems = append(
					problems,
					"Missing acknowledgement for '"+unit.Target+"' ("+unit.Readable+" at "+unit.location()+") in "+sourceLabel(state.Spec)+" "+citerLabel(citer.Spec)+". Add '@evidence "+unit.Target+" <reason>' to a selected "+string(citer.Spec.Type)+" host, or '@evidenceExclude "+unit.Target+" <reason>' when this group intentionally does not use it.",
				)
			}
		}
	}
	return problems
}

func declarationCandidates(
	target string,
	targets map[string]map[string]*evidenceUnit,
	markdownTargets map[string]map[string]*evidenceUnit,
) map[string]*evidenceUnit {
	candidates := map[string]*evidenceUnit{}
	for id, unit := range targets[target] {
		candidates[id] = unit
	}
	normalized := normalizeMarkdownTarget(target)
	if normalized != target {
		for id, unit := range markdownTargets[normalized] {
			candidates[id] = unit
		}
	}
	return candidates
}

func inventoriesOf(
	kind artifactKind,
	markdown map[string]*artifactInventory,
	typescript map[string]*artifactInventory,
) map[string]*artifactInventory {
	if kind == artifactMarkdown {
		return markdown
	}
	return typescript
}

func matchingInventoryPaths(
	inventories map[string]*artifactInventory,
	globs globSet,
) []string {
	paths := []string{}
	for path := range inventories {
		if globs.matches(path) {
			paths = append(paths, path)
		}
	}
	sort.Strings(paths)
	return paths
}

func sortUnits(units []*evidenceUnit) {
	sort.Slice(units, func(left int, right int) bool {
		if units[left].Target != units[right].Target {
			return units[left].Target < units[right].Target
		}
		return units[left].ID < units[right].ID
	})
}

func sourceLabel(source sourceSpec) string {
	label := "Source " + decimal(source.Index+1)
	if source.Name != "" {
		label += " ('" + source.Name + "')"
	}
	return label
}

func citerLabel(citer citerSpec) string {
	return "citer " + decimal(citer.Index+1) + " (" + string(citer.Type) + ", symbols: " + citer.Symbols.names() + ")"
}

func reportProblems(ctx *rule.ProjectContext, problems []string) {
	sort.Strings(problems)
	previous := ""
	for _, problem := range problems {
		if problem == "" || problem == previous {
			continue
		}
		ctx.Report(problem)
		previous = problem
	}
}
