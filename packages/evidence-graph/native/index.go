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
	states, stateProblems := materializeClaimStates(config, markdown, typescript)
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

func materializeClaimStates(
	config graphConfig,
	markdown map[string]*artifactInventory,
	typescript map[string]*artifactInventory,
) ([]claimState, []string) {
	states := make([]claimState, 0, len(config.Claims))
	problems := []string{}
	for _, claim := range config.Claims {
		inventories := inventoriesOf(claim.Type, markdown, typescript)
		paths := matchingInventoryPaths(inventories, claim.Files)
		state := claimState{Spec: claim, Paths: paths}
		if len(paths) == 0 {
			problems = append(
				problems,
				claimLabel(claim)+" matched no "+string(claim.Type)+" files for "+describePatterns(claim.Files)+". Fix the project-relative globs; '*' stays within one segment, '**' crosses segments, and a bare directory is not recursive.",
			)
		}
		for _, path := range paths {
			state.Declarations = append(
				state.Declarations,
				inventories[path].Declarations...,
			)
		}
		for _, reference := range claim.References {
			referenceInventories := inventoriesOf(reference.Type, markdown, typescript)
			referencePaths := matchingInventoryPaths(referenceInventories, reference.Files)
			referenceState := referenceState{
				Spec:         reference,
				Paths:        referencePaths,
				UnitsByScope: map[string][]*evidenceUnit{},
			}
			if len(referencePaths) == 0 {
				problems = append(
					problems,
					claimLabel(claim)+" "+referenceLabel(reference)+" matched no "+string(reference.Type)+" files for "+describePatterns(reference.Files)+". Fix the reference globs; this obligation cannot materialize evidence units without files.",
				)
			}
			selectedInventoryProblem := false
			availableUnits := map[string]*evidenceUnit{}
			selectedUnits := map[string]bool{}
			for _, path := range referencePaths {
				for _, inventoryProblem := range referenceInventories[path].Problems {
					if inventoryProblem.Symbol == "*" ||
						reference.Symbols.contains(inventoryProblem.Symbol) {
						selectedInventoryProblem = true
					}
				}
				for _, unit := range referenceInventories[path].Units {
					availableUnits[unit.ID] = unit
					if !reference.Symbols.contains(unit.Symbol) ||
						selectedUnits[unit.ID] {
						continue
					}
					selectedUnits[unit.ID] = true
					referenceState.Units = append(referenceState.Units, unit)
				}
			}
			sortUnits(referenceState.Units)
			scopesByID := map[string]*evidenceUnit{}
			for _, unit := range referenceState.Units {
				for scope := unit; scope != nil; scope = availableUnits[scope.ParentID] {
					referenceState.UnitsByScope[scope.ID] = append(
						referenceState.UnitsByScope[scope.ID],
						unit,
					)
					if scopesByID[scope.ID] == nil {
						scopesByID[scope.ID] = scope
						referenceState.Scopes = append(referenceState.Scopes, scope)
					}
					if scope.ParentID == "" {
						break
					}
				}
			}
			sortUnits(referenceState.Scopes)
			if len(referencePaths) != 0 &&
				len(referenceState.Units) == 0 &&
				!selectedInventoryProblem {
				problems = append(
					problems,
					claimLabel(claim)+" "+referenceLabel(reference)+" matched "+decimal(len(referencePaths))+" file(s) but materialized no selected evidence units ("+reference.Symbols.names()+"). Select symbol kinds present in those files or correct the reference globs.",
				)
			}
			state.References = append(state.References, referenceState)
		}
		states = append(states, state)
	}
	return states, problems
}

func evaluateEvidenceGraph(states []claimState) []string {
	problems := []string{}
	targets := map[string]map[string]*evidenceUnit{}
	markdownTargets := map[string]map[string]*evidenceUnit{}
	for _, state := range states {
		for _, reference := range state.References {
			for _, unit := range reference.Scopes {
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
	}

	declarations := map[string]*evidenceDeclaration{}
	for _, state := range states {
		for _, declaration := range state.Declarations {
			declarations[declaration.ID] = declaration
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
		if len(state.Paths) == 0 {
			continue
		}
		for _, reference := range state.References {
			if len(reference.Paths) == 0 || len(reference.Units) == 0 {
				continue
			}
			acknowledged := map[string]*evidenceDeclaration{}
			for _, declaration := range state.Declarations {
				scopeID := resolved[declaration.ID]
				covered := reference.UnitsByScope[scopeID]
				if len(covered) == 0 {
					continue
				}
				hosts := declaration.Hosts
				if !state.Spec.Symbols.intersects(hosts) {
					host := hosts.names()
					if len(hosts) == 0 {
						host = "unsupported or non-exported declaration"
					}
					problems = append(
						problems,
						"Out-of-scope @"+string(declaration.Tag)+" host at "+declaration.location()+" for "+claimLabel(state.Spec)+": host kind '"+host+"' is not selected ("+state.Spec.Symbols.names()+"). Move the declaration to a selected host or widen this claim's symbol selector.",
					)
					continue
				}
				var overlappingUnit *evidenceUnit
				var firstAcknowledgement *evidenceDeclaration
				for _, unit := range covered {
					if first := acknowledged[unit.ID]; first != nil {
						if overlappingUnit == nil {
							overlappingUnit = unit
							firstAcknowledgement = first
						}
						continue
					}
					acknowledged[unit.ID] = declaration
				}
				if overlappingUnit != nil {
					problems = append(
						problems,
						"Duplicate acknowledgement for '"+overlappingUnit.Target+"' in "+claimLabel(state.Spec)+" "+referenceLabel(reference.Spec)+" at "+declaration.location()+": scope '"+declaration.Target+"' overlaps the first acknowledgement at "+firstAcknowledgement.location()+". Keep @evidence and @evidenceExclude scopes disjoint within this claim.",
					)
				}
			}
			for _, unit := range reference.Units {
				if acknowledged[unit.ID] != nil {
					continue
				}
				problems = append(
					problems,
					"Missing acknowledgement for '"+unit.Target+"' ("+unit.Readable+" at "+unit.location()+") in "+claimLabel(state.Spec)+" "+referenceLabel(reference.Spec)+". Add '@evidence "+unit.Target+" <reason>' to a selected "+string(state.Spec.Type)+" host of this claim, or '@evidenceExclude "+unit.Target+" <reason>' when this claim intentionally does not use it.",
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

func claimLabel(claim claimSpec) string {
	label := "Claim " + decimal(claim.Index+1)
	if claim.Name != "" {
		label += " ('" + claim.Name + "')"
	}
	return label
}

func referenceLabel(reference referenceSpec) string {
	return "reference " + decimal(reference.Index+1) + " (" + string(reference.Type) + ", symbols: " + reference.Symbols.names() + ")"
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
