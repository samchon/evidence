package evidence

import (
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// moduleExport is one name a module offers to whoever imports it.
//
// A local export names a declaration in this file; a re-export names one in
// another. Keeping the two apart is what lets identity stay with the declaring
// file while reachability is decided by whoever re-exports it.
type moduleExport struct {
	// Public is the name an importer sees. Empty for `export * from`, which
	// contributes its target's names rather than a name of its own.
	Public string
	// Local is the declaration's own name in this file, empty for a re-export.
	Local string
	// Specifier is the module a re-export pulls from, empty for a local export.
	Specifier string
	// Imported is the name taken from that module, empty for a star re-export.
	Imported string
	// Namespace marks `export * as ns from`, which nests the target's whole
	// surface one segment deeper instead of flattening it.
	Namespace bool
}

// collectModuleExports reads a file's public surface as importers see it.
//
// The materializer deliberately skips re-exports when building units, because a
// re-export declares nothing and must not create a second unit. That rule is
// untouched here: this table records reachability, and identity is resolved
// separately by following the specifier to the file that declares the symbol.
func collectModuleExports(file *shimast.SourceFile) []moduleExport {
	exports := []moduleExport{}
	if file == nil || file.Statements == nil {
		return exports
	}
	locals := collectLocalExportNames(file.Statements)
	for _, statement := range file.Statements.Nodes {
		if statement == nil {
			continue
		}
		if statement.Kind == shimast.KindExportDeclaration {
			exports = append(exports, exportDeclarationEntries(statement, locals)...)
			continue
		}
		if !isSyntacticallyExported(statement) {
			continue
		}
		for _, declared := range topLevelDeclaredNames(statement) {
			exports = append(exports, moduleExport{
				Public: declared.Name,
				Local:  declared.Name,
			})
			for _, exported := range locals[declared.Name] {
				if exported.Public != declared.Name {
					exports = append(exports, moduleExport{
						Public: exported.Public,
						Local:  declared.Name,
					})
				}
			}
		}
	}
	for local, names := range locals {
		for _, exported := range names {
			if exported.Public == "" {
				continue
			}
			exports = append(exports, moduleExport{
				Public: exported.Public,
				Local:  local,
			})
		}
	}
	return dedupeModuleExports(exports)
}

func exportDeclarationEntries(
	statement *shimast.Node,
	locals map[string][]exportedName,
) []moduleExport {
	declaration := statement.AsExportDeclaration()
	if declaration == nil {
		return nil
	}
	specifier := stringLiteralText(declaration.ModuleSpecifier)
	if specifier == "" {
		// A local export list is already covered by the locals table, which the
		// caller folds in; recording it twice would double every aliased name.
		return nil
	}
	if declaration.ExportClause == nil {
		return []moduleExport{{Specifier: specifier}}
	}
	switch declaration.ExportClause.Kind {
	case shimast.KindNamespaceExport:
		name := declarationName(declaration.ExportClause.Name())
		if name == "" {
			return nil
		}
		return []moduleExport{{
			Public:    name,
			Specifier: specifier,
			Namespace: true,
		}}
	case shimast.KindNamedExports:
		named := declaration.ExportClause.AsNamedExports()
		if named == nil || named.Elements == nil {
			return nil
		}
		entries := []moduleExport{}
		for _, element := range named.Elements.Nodes {
			if element == nil || element.Kind != shimast.KindExportSpecifier {
				continue
			}
			exportSpecifier := element.AsExportSpecifier()
			if exportSpecifier == nil {
				continue
			}
			public := declarationName(element.Name())
			imported := public
			if exportSpecifier.PropertyName != nil {
				imported = declarationName(exportSpecifier.PropertyName)
			}
			if public == "" || imported == "" {
				continue
			}
			entries = append(entries, moduleExport{
				Public:    public,
				Specifier: specifier,
				Imported:  imported,
			})
		}
		return entries
	}
	return nil
}

func dedupeModuleExports(exports []moduleExport) []moduleExport {
	seen := map[moduleExport]bool{}
	unique := make([]moduleExport, 0, len(exports))
	for _, export := range exports {
		if seen[export] {
			continue
		}
		seen[export] = true
		unique = append(unique, export)
	}
	sort.SliceStable(unique, func(left int, right int) bool {
		return unique[left].Public < unique[right].Public
	})
	return unique
}

// reachedSymbol is one public address an entry traversal arrived at.
type reachedSymbol struct {
	// Address is the accessor path from the entry, segment by segment.
	Address []string
	// Path is the file that declares the symbol, which owns its identity.
	Path string
	// Local is the declaration's qualified name inside that file.
	Local string
}

// traverseEntryExports walks a module's export graph and reports every public
// symbol it reaches, with the address the entry gives it.
//
// Membership comes from reachability and identity comes from the declaring
// file, so a symbol re-exported through two barrels is reached twice and still
// resolves to one unit. Cycles are bounded by the visited set: a barrel that
// re-exports itself is a real shape, not a reason to hang the build.
func traverseEntryExports(
	loader *typeScriptLoader,
	entry string,
	prefix []string,
	visited map[string]bool,
) []reachedSymbol {
	if visited[entry] {
		return nil
	}
	visited[entry] = true
	defer delete(visited, entry)

	inventory := loader.inventory(entry)
	if inventory == nil {
		return nil
	}
	reached := []reachedSymbol{}
	// Named re-exports are grouped by the module they come from and that module
	// is walked once. Walking it per specifier would re-traverse the whole
	// subtree for every name a barrel forwards, which is quadratic on exactly
	// the wide generated barrels this selection exists to describe.
	surfaces := map[string]map[string]reachedSymbol{}
	surfaceOf := func(target string) map[string]reachedSymbol {
		if surface, built := surfaces[target]; built {
			return surface
		}
		surface := map[string]reachedSymbol{}
		for _, nested := range traverseEntryExports(loader, target, nil, visited) {
			if len(nested.Address) != 1 {
				continue
			}
			if _, taken := surface[nested.Address[0]]; !taken {
				surface[nested.Address[0]] = nested
			}
		}
		surfaces[target] = surface
		return surface
	}
	for _, export := range inventory.Exports {
		if export.Specifier == "" {
			reached = append(reached, reachedSymbol{
				Address: append(append([]string{}, prefix...), export.Public),
				Path:    entry,
				Local:   export.Local,
			})
			continue
		}
		target := loader.resolve(entry, export.Specifier)
		if target == "" {
			continue
		}
		switch {
		case export.Namespace:
			reached = append(reached, traverseEntryExports(
				loader,
				target,
				append(append([]string{}, prefix...), export.Public),
				visited,
			)...)
		case export.Imported == "":
			reached = append(reached, traverseEntryExports(
				loader,
				target,
				prefix,
				visited,
			)...)
		default:
			nested, found := surfaceOf(target)[export.Imported]
			if !found {
				continue
			}
			reached = append(reached, reachedSymbol{
				Address: append(append([]string{}, prefix...), export.Public),
				Path:    nested.Path,
				Local:   nested.Local,
			})
		}
	}
	return reached
}

// materializeEntryUnits turns reached symbols into the units an obligation
// counts, giving each its entry-relative address.
//
// A declaration's descendants travel with it: reaching `ISale` also reaches
// `ISale.price`, because the property is addressable exactly when its owner is.
// Addresses are rebuilt from identity segments rather than by rewriting the
// joined target, so a literal dot inside a name cannot collapse into
// qualification.
func materializeEntryUnits(
	loader *typeScriptLoader,
	entry string,
	symbols symbolSet,
) []*evidenceUnit {
	reached := traverseEntryExports(loader, entry, nil, map[string]bool{})
	byID := map[string]*evidenceUnit{}
	order := []string{}
	for _, symbol := range reached {
		inventory := loader.inventory(symbol.Path)
		if inventory == nil || symbol.Local == "" {
			continue
		}
		for _, unit := range inventory.Units {
			suffix, owned := identitySuffix(unit.Identity, symbol.Local)
			if !owned {
				continue
			}
			address := append(append([]string{}, symbol.Address...), suffix...)
			target := strings.Join(address, ".")
			existing := byID[unit.ID]
			if existing == nil {
				clone := *unit
				clone.Target = target
				clone.Identity = address
				clone.Aliases = nil
				byID[unit.ID] = &clone
				order = append(order, unit.ID)
				continue
			}
			if existing.Target == target || containsString(existing.Aliases, target) {
				continue
			}
			// Two addresses for one declaration. The shorter one reads as the
			// canonical path, and the rest resolve to the same unit so the
			// obligation is still counted once.
			if len(address) < len(existing.Identity) {
				existing.Aliases = append(existing.Aliases, existing.Target)
				existing.Target = target
				existing.Identity = address
				continue
			}
			existing.Aliases = append(existing.Aliases, target)
		}
	}
	units := make([]*evidenceUnit, 0, len(order))
	for _, id := range order {
		unit := byID[id]
		if !symbols.contains(unit.Symbol) {
			continue
		}
		sort.Strings(unit.Aliases)
		units = append(units, unit)
	}
	return units
}

// identitySuffix reports the segments below a reached declaration, and whether
// the unit belongs to it at all.
func identitySuffix(identity []string, local string) ([]string, bool) {
	owner := strings.Split(local, ".")
	if len(identity) < len(owner) {
		return nil, false
	}
	for index, segment := range owner {
		if identity[index] != segment {
			return nil, false
		}
	}
	return identity[len(owner):], true
}

func containsString(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}
