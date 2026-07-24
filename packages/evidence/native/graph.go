package evidence

import (
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/samchon/ttsc/packages/lint/rule"
)

type graphRule struct{}

func (graphRule) Name() string { return graphRuleName }

func (graphRule) NeedsTypeChecker() bool { return false }

func (graphRule) Check(ctx *rule.ProjectContext) {
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
	swagger, swaggerProblems := loadSwaggerInventories(root, config)
	typescript := loadTypeScriptInventories(root, ctx.Sources)
	problems = append(problems, markdownProblems...)
	problems = append(problems, swaggerProblems...)
	loader := newTypeScriptLoader(root, typescript)
	states, stateProblems := materializeClaimStates(
		config,
		markdown,
		swagger,
		typescript,
		loader,
	)
	problems = append(problems, stateProblems...)
	problems = append(problems, evaluateEvidenceGraph(states, loader)...)
	reportProblems(ctx, problems)
}

func init() {
	rule.RegisterProject(graphRule{})
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
	swagger map[string]*artifactInventory,
	typescript map[string]*artifactInventory,
	loader *typeScriptLoader,
) ([]claimState, []string) {
	states := make([]claimState, 0, len(config.Claims))
	problems := []string{}
	for _, claim := range config.Claims {
		inventories := inventoriesOf(claim.Type, markdown, swagger, typescript)
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
			referenceInventories := inventoriesOf(
				reference.Type,
				markdown,
				swagger,
				typescript,
			)
			if reference.Type == artifactTypeScript && reference.entrySelected() {
				entryState, entryProblems := materializeEntryReference(
					claim,
					reference,
					loader,
				)
				problems = append(problems, entryProblems...)
				state.References = append(state.References, entryState)
				continue
			}
			if reference.Type == artifactTypeScript && reference.Package != "" {
				packageState, packageProblems := materializePackageGlobReference(
					claim,
					reference,
					loader,
				)
				problems = append(problems, packageProblems...)
				state.References = append(state.References, packageState)
				continue
			}
			referencePaths := matchingReferencePaths(
				referenceInventories,
				reference,
			)
			referenceState := referenceState{
				Spec:         reference,
				Paths:        referencePaths,
				UnitsByScope: map[string][]*evidenceUnit{},
			}
			if len(referencePaths) == 0 {
				if reference.Type == artifactSwagger {
					problems = append(
						problems,
						claimLabel(claim)+" "+referenceLabel(reference)+" matched no swagger source for "+describeReferenceSources(reference)+". Fix the reference location; this obligation cannot materialize evidence units without a source.",
					)
				} else {
					problems = append(
						problems,
						claimLabel(claim)+" "+referenceLabel(reference)+" matched no "+string(reference.Type)+" files for "+describePatterns(reference.Files)+". Fix the reference globs; this obligation cannot materialize evidence units without files.",
					)
				}
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

func evaluateEvidenceGraph(
	states []claimState,
	loader *typeScriptLoader,
) []string {
	problems := []string{}
	targets := map[string]map[string]*evidenceUnit{}
	markdownTargets := map[string]map[string]*evidenceUnit{}
	// Scoped targets are keyed by owning file as well as name, which is what
	// makes import-scope resolution unambiguous: two modules exporting `get`
	// never compete, because resolution already knows which file it landed in.
	scopedTargets := map[string]map[string]*evidenceUnit{}
	for _, state := range states {
		for _, reference := range state.References {
			// An entry-selected address is valid in the module that exposes it,
			// not in the one that declares the symbol. Identity still belongs to
			// the declaring file; only reachability moves.
			addressPath := ""
			if reference.Spec.entrySelected() && len(reference.Paths) == 1 {
				addressPath = reference.Paths[0]
			}
			for _, unit := range reference.Scopes {
				for _, address := range append([]string{unit.Target}, unit.Aliases...) {
					if targets[address] == nil {
						targets[address] = map[string]*evidenceUnit{}
					}
					targets[address][unit.ID] = unit
				}
				if unit.Type == artifactMarkdown {
					if markdownTargets[unit.Target] == nil {
						markdownTargets[unit.Target] = map[string]*evidenceUnit{}
					}
					markdownTargets[unit.Target][unit.ID] = unit
				}
				if unit.Type == artifactTypeScript {
					owner := unit.Path
					if addressPath != "" {
						owner = addressPath
					}
					// Every address the unit answers to indexes the same unit, so
					// a symbol an entry exposes by two paths is one obligation
					// acknowledged once rather than two competing candidates.
					for _, address := range append([]string{unit.Target}, unit.Aliases...) {
						key := scopedTargetKey(owner, address)
						if scopedTargets[key] == nil {
							scopedTargets[key] = map[string]*evidenceUnit{}
						}
						scopedTargets[key][unit.ID] = unit
					}
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
		if isInlineLinkTarget(declaration.Target) {
			unitID, problem := resolveInlineLinkDeclaration(
				declaration,
				loader,
				scopedTargets,
			)
			if problem != "" {
				problems = append(problems, problem)
				continue
			}
			resolved[id] = unitID
			continue
		}
		if declaration.Type == artifactTypeScript &&
			looksLikeTypeScriptTarget(declaration.Target, targets, markdownTargets) {
			problems = append(
				problems,
				"Unbraced TypeScript evidence target '"+declaration.Target+"' at "+declaration.location()+": a target naming a symbol is now written as an inline link, so the citing module's import is what resolves it. Write '@"+string(declaration.Tag)+" {@link "+declaration.Target+"} <reason>' and import the symbol; 'import type' is enough.",
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
					"Missing acknowledgement for '"+unit.Target+"' ("+unit.Readable+" at "+unit.location()+") in "+claimLabel(state.Spec)+" "+referenceLabel(reference.Spec)+". Add '@evidence "+acknowledgementForm(unit, state.Spec)+" <reason>' to a selected "+string(state.Spec.Type)+" host of this claim, or '@evidenceExclude "+acknowledgementForm(unit, state.Spec)+" <reason>' when this claim intentionally does not use it.",
				)
			}
		}
	}
	return problems
}

// materializeEntryReference builds a population by walking an entry module's
// export graph rather than by matching paths.
//
// The entry is what a consumer can actually import, so the population is the
// public contract instead of whatever files a glob happened to sweep in. It is
// also the only selection that can reach a package symbol nothing imports,
// because such a symbol is absent from the Program by definition.
func materializeEntryReference(
	claim claimSpec,
	reference referenceSpec,
	loader *typeScriptLoader,
) (referenceState, []string) {
	state := referenceState{
		Spec:         reference,
		UnitsByScope: map[string][]*evidenceUnit{},
	}
	entry, problem := resolveReferenceEntry(claim, reference, loader)
	if problem != "" {
		return state, []string{problem}
	}
	state.Paths = []string{entry}
	state.Units = materializeEntryUnits(loader, entry, reference.Symbols)
	if len(state.Units) == 0 {
		return state, []string{
			claimLabel(claim) + " " + referenceLabel(reference) + " reached no selected evidence units (" + reference.Symbols.names() + ") from entry '" + entry + "'. Select symbol kinds the entry exposes, or point the entry at the module that declares them.",
		}
	}
	sortUnits(state.Units)
	for _, unit := range state.Units {
		state.Scopes = append(state.Scopes, unit)
		state.UnitsByScope[unit.ID] = append(state.UnitsByScope[unit.ID], unit)
	}
	// An entry-selected population is flat by address rather than by file, so a
	// parent type still has to cover the properties it owns. Walking addresses
	// keeps that cascade without reintroducing file-shaped hierarchy.
	for _, unit := range state.Units {
		for _, other := range state.Units {
			if other.ID == unit.ID || !addressContains(unit.Identity, other.Identity) {
				continue
			}
			state.UnitsByScope[unit.ID] = append(state.UnitsByScope[unit.ID], other)
		}
	}
	return state, nil
}

// materializePackageGlobReference narrows an installed package with globs that
// resolve against the package root.
//
// Narrowing a large SDK to one area is what makes the obligation adoptable at
// all. The globs are written as a consumer thinks of the package — `lib/api/**`
// — rather than carrying the `node_modules` prefix, which is an installation
// detail rather than part of the package's shape.
func materializePackageGlobReference(
	claim claimSpec,
	reference referenceSpec,
	loader *typeScriptLoader,
) (referenceState, []string) {
	state := referenceState{
		Spec:         reference,
		UnitsByScope: map[string][]*evidenceUnit{},
	}
	base := referenceBase(reference)
	available := map[string]*evidenceUnit{}
	for _, candidate := range loader.walk(base) {
		relative := strings.TrimPrefix(strings.TrimPrefix(candidate, base), "/")
		if !reference.Files.matches(relative) {
			continue
		}
		inventory := loader.inventory(candidate)
		if inventory == nil {
			continue
		}
		state.Paths = append(state.Paths, candidate)
		for _, unit := range inventory.Units {
			available[unit.ID] = unit
		}
	}
	if len(state.Paths) == 0 {
		return state, []string{
			claimLabel(claim) + " " + referenceLabel(reference) + " matched no files inside package '" + reference.Package + "' for " + describePatterns(reference.Files) + ". Fix the package-relative globs; they resolve against the package root, not the project root.",
		}
	}
	collectReferenceUnits(&state, reference, available)
	if len(state.Units) == 0 {
		return state, []string{
			claimLabel(claim) + " " + referenceLabel(reference) + " matched " + decimal(len(state.Paths)) + " file(s) inside package '" + reference.Package + "' but materialized no selected evidence units (" + reference.Symbols.names() + "). Select symbol kinds present in those files or correct the globs.",
		}
	}
	return state, nil
}

// collectReferenceUnits selects units and rebuilds the scope hierarchy over
// them, so an ancestor target still covers the descendants it owns.
func collectReferenceUnits(
	state *referenceState,
	reference referenceSpec,
	available map[string]*evidenceUnit,
) {
	selected := map[string]bool{}
	for _, unit := range available {
		if !reference.Symbols.contains(unit.Symbol) || selected[unit.ID] {
			continue
		}
		selected[unit.ID] = true
		state.Units = append(state.Units, unit)
	}
	sortUnits(state.Units)
	scopesByID := map[string]*evidenceUnit{}
	for _, unit := range state.Units {
		for scope := unit; scope != nil; scope = available[scope.ParentID] {
			state.UnitsByScope[scope.ID] = append(state.UnitsByScope[scope.ID], unit)
			if scopesByID[scope.ID] == nil {
				scopesByID[scope.ID] = scope
				state.Scopes = append(state.Scopes, scope)
			}
			if scope.ParentID == "" {
				break
			}
		}
	}
	sortUnits(state.Scopes)
}

func resolveReferenceEntry(
	claim claimSpec,
	reference referenceSpec,
	loader *typeScriptLoader,
) (string, string) {
	base := referenceBase(reference)
	if reference.Entry != "" {
		candidate := reference.Entry
		if base != "" {
			candidate = path.Join(base, reference.Entry)
		}
		for _, option := range moduleCandidates(candidate) {
			if loader.exists(option) {
				return option, ""
			}
		}
		return "", claimLabel(claim) + " " + referenceLabel(reference) + " found no entry module at '" + candidate + "'. Correct the entry path; this obligation cannot materialize evidence units without one."
	}
	entry := loader.packageEntryModule(reference.Package)
	if entry == "" {
		return "", claimLabel(claim) + " " + referenceLabel(reference) + " could not resolve the declaration entry of package '" + reference.Package + "'. Install it, or name its entry with 'file'; the entry is read from the 'types' condition of 'exports', then 'typesVersions', then 'types'."
	}
	return entry, ""
}

// addressContains reports whether one entry-relative address encloses another.
func addressContains(owner []string, candidate []string) bool {
	if len(candidate) <= len(owner) {
		return false
	}
	for index, segment := range owner {
		if candidate[index] != segment {
			return false
		}
	}
	return true
}

// acknowledgementForm spells the citation a claim would actually have to write.
//
// A TypeScript unit is cited through an inline link resolved by the citing
// module's imports, so suggesting the bare name would name the one form the
// rule now rejects. Markdown claims keep the plain token, because Markdown has
// no import scope to resolve one against.
func acknowledgementForm(unit *evidenceUnit, claim claimSpec) string {
	if unit.Type != artifactTypeScript || claim.Type != artifactTypeScript {
		return unit.Target
	}
	return "{@link " + unit.Target + "}"
}

func scopedTargetKey(path string, target string) string {
	return path + "\x00" + target
}

// looksLikeTypeScriptTarget reports whether an unbraced target names a symbol.
//
// The migration diagnostic has to be told apart from an ordinary typo, and the
// signal is that the same spelling still materializes as a TypeScript unit
// somewhere in the configured graph. A Markdown path or a Swagger operation
// never does, so neither is mistaken for a symbol that lost its braces.
func looksLikeTypeScriptTarget(
	target string,
	targets map[string]map[string]*evidenceUnit,
	markdownTargets map[string]map[string]*evidenceUnit,
) bool {
	if len(markdownTargets[target]) != 0 {
		return false
	}
	for _, unit := range targets[target] {
		if unit.Type == artifactTypeScript {
			return true
		}
	}
	return false
}

// resolveInlineLinkDeclaration resolves a braced target through the citing
// module's imports, the way TypeScript resolves the same name.
//
// Every failure gets its own diagnostic. A single "unresolved" would leave the
// author guessing which of four independent things went wrong, and three of
// them are repaired in completely different places.
func resolveInlineLinkDeclaration(
	declaration *evidenceDeclaration,
	loader *typeScriptLoader,
	scopedTargets map[string]map[string]*evidenceUnit,
) (string, string) {
	target := inlineLinkTarget(declaration.Target)
	if declaration.Type != artifactTypeScript {
		return "", "Inline link target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + ": only a TypeScript declaration can cite through an inline link, because resolution runs through the citing module's imports and Markdown has none. Write the symbol as a plain target here."
	}
	inventory := loader.inventory(declaration.Path)
	if inventory == nil {
		return "", "Inline link target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + ": the citing file is not part of the TypeScript program, so it has no import scope to resolve against."
	}
	segments := strings.Split(target, ".")
	binding, imported := inventory.Imports[segments[0]]
	if !imported {
		return "", "Unimported evidence target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + ": '" + segments[0] + "' is not imported by this module, so the citation names a symbol this file does not reference. Import it; 'import type' is enough and is erased at emit."
	}
	// Resolution goes through the same loader the population uses, so a citation
	// can reach a package entry that never entered the Program — which is the
	// only way an import of an installed SDK resolves at all.
	resolvedPath := loader.resolve(declaration.Path, binding.Specifier)
	if resolvedPath == "" {
		return "", "Unresolved module '" + binding.Specifier + "' for evidence target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + ": the specifier resolves to no TypeScript file reachable from this project. Correct the import, or add the module to the program."
	}
	remaining := segments[1:]
	if !binding.Namespace {
		remaining = append([]string{binding.Imported}, remaining...)
	}
	if len(remaining) == 0 {
		return "", "Incomplete evidence target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + ": a namespace import names a module rather than a unit. Name a symbol inside '" + binding.Specifier + "'."
	}
	name := strings.Join(remaining, ".")
	candidates := scopedTargets[scopedTargetKey(resolvedPath, name)]
	switch len(candidates) {
	case 0:
		return "", "Unreachable evidence target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + ": '" + resolvedPath + "' declares no selected unit named '" + name + "'. Correct the target, or widen the reference's files and symbol selection so that unit is configured evidence."
	case 1:
		for _, unit := range candidates {
			return unit.ID, ""
		}
		return "", ""
	default:
		// One module may spell one name in two declaration spaces — a type and a
		// callable, say. Resolution landed in the right file and still cannot say
		// which unit was meant, and picking one silently would acknowledge an
		// obligation the author never cited.
		descriptions := make([]string, 0, len(candidates))
		for _, unit := range candidates {
			descriptions = append(descriptions, unit.Readable+" at "+unit.location())
		}
		sort.Strings(descriptions)
		return "", "Ambiguous evidence target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + ": '" + resolvedPath + "' declares " + strings.Join(descriptions, "; ") + " under that name. Narrow the reference's symbol selection so the target has exactly one meaning."
	}
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
	swagger map[string]*artifactInventory,
	typescript map[string]*artifactInventory,
) map[string]*artifactInventory {
	switch kind {
	case artifactMarkdown:
		return markdown
	case artifactSwagger:
		return swagger
	case artifactTypeScript:
		return typescript
	default:
		return map[string]*artifactInventory{}
	}
}

func matchingReferencePaths(
	inventories map[string]*artifactInventory,
	reference referenceSpec,
) []string {
	if reference.Type != artifactSwagger {
		return matchingInventoryPaths(inventories, reference.Files)
	}
	if inventories[reference.Source] == nil {
		return nil
	}
	return []string{reference.Source}
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
	if reference.Type == artifactSwagger {
		return "reference " + decimal(reference.Index+1) + " (swagger operations)"
	}
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
