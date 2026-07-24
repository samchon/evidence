package evidence

import (
	"path/filepath"
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

func loadTypeScriptInventories(
	root string,
	sources []*shimast.SourceFile,
) map[string]*artifactInventory {
	inventories := map[string]*artifactInventory{}
	for _, file := range sources {
		if file == nil {
			continue
		}
		relative, ok := relativeProjectPath(root, file.FileName())
		if !ok || !isTypeScriptPath(relative) {
			continue
		}
		inventories[relative] = scanTypeScriptInventory(relative, file)
	}
	return inventories
}

func isTypeScriptPath(path string) bool {
	path = strings.ToLower(path)
	for _, suffix := range []string{".ts", ".tsx", ".mts", ".cts"} {
		if strings.HasSuffix(path, suffix) {
			return true
		}
	}
	return false
}

func relativeProjectPath(root string, absolute string) (string, bool) {
	if root == "" || absolute == "" {
		return "", false
	}
	relative, err := filepath.Rel(root, absolute)
	if err != nil {
		return "", false
	}
	relative = strings.ReplaceAll(relative, "\\", "/")
	if relative == ".." || strings.HasPrefix(relative, "../") {
		return "", false
	}
	return strings.TrimPrefix(relative, "./"), true
}

func scanTypeScriptInventory(
	path string,
	file *shimast.SourceFile,
) *artifactInventory {
	inventory := &artifactInventory{
		Path:    path,
		Type:    artifactTypeScript,
		Imports: collectImportBindings(file),
		Exports: collectModuleExports(file),
	}
	supportedHosts := map[*shimast.Node]symbolSet{}
	unitsByID := map[string]*evidenceUnit{}
	collectTypeScriptStatements(
		file.Statements,
		nil,
		"",
		inventory,
		supportedHosts,
		unitsByID,
		file.IsDeclarationFile,
		false,
		false,
	)
	collectTypeScriptDeclarations(file, path, inventory, supportedHosts)
	sort.Slice(inventory.Units, func(left int, right int) bool {
		if inventory.Units[left].Target != inventory.Units[right].Target {
			return inventory.Units[left].Target < inventory.Units[right].Target
		}
		return inventory.Units[left].Line < inventory.Units[right].Line
	})
	return inventory
}

func collectTypeScriptStatements(
	statements *shimast.NodeList,
	prefix []string,
	parentID string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
	unitsByID map[string]*evidenceUnit,
	ambientContext bool,
	implicitlyExported bool,
	typeOnlyProjection bool,
) {
	if statements == nil {
		return
	}
	exports := collectLocalExportNames(statements)
	for _, statement := range statements.Nodes {
		if statement == nil {
			continue
		}
		switch statement.Kind {
		case shimast.KindInterfaceDeclaration:
			name := declarationName(statement.Name())
			if name == "" {
				continue
			}
			targets := publicTypeScriptNames(
				statement,
				name,
				exports,
				true,
				implicitlyExported,
			)
			if len(targets) == 0 {
				continue
			}
			addTypeScriptHost(supportedHosts, statement, "type")
			for _, name := range targets {
				identity := qualifyTypeScriptName(prefix, name)
				unit := addTypeScriptUnit(
					inventory,
					unitsByID,
					statement,
					"type",
					identity,
					parentID,
				)
				collectPropertyMembers(
					statement.AsInterfaceDeclaration().Members,
					identity,
					unit.ID,
					inventory,
					supportedHosts,
					unitsByID,
				)
			}
		case shimast.KindTypeAliasDeclaration:
			name := declarationName(statement.Name())
			if name == "" {
				continue
			}
			targets := publicTypeScriptNames(
				statement,
				name,
				exports,
				true,
				implicitlyExported,
			)
			if len(targets) == 0 {
				continue
			}
			addTypeScriptHost(supportedHosts, statement, "type")
			alias := statement.AsTypeAliasDeclaration()
			for _, name := range targets {
				identity := qualifyTypeScriptName(prefix, name)
				unit := addTypeScriptUnit(
					inventory,
					unitsByID,
					statement,
					"type",
					identity,
					parentID,
				)
				if alias.Type != nil && alias.Type.Kind == shimast.KindTypeLiteral {
					collectPropertyMembers(
						alias.Type.AsTypeLiteralNode().Members,
						identity,
						unit.ID,
						inventory,
						supportedHosts,
						unitsByID,
					)
				}
			}
		case shimast.KindFunctionDeclaration:
			if typeOnlyProjection {
				continue
			}
			name := declarationName(statement.Name())
			if name == "" {
				continue
			}
			targets := publicTypeScriptNames(
				statement,
				name,
				exports,
				false,
				implicitlyExported,
			)
			if len(targets) == 0 {
				continue
			}
			addTypeScriptHost(supportedHosts, statement, "function")
			for _, name := range targets {
				addTypeScriptUnit(
					inventory,
					unitsByID,
					statement,
					"function",
					qualifyTypeScriptName(prefix, name),
					parentID,
				)
			}
		case shimast.KindVariableStatement:
			if typeOnlyProjection {
				continue
			}
			for symbol := range collectTypeScriptVariables(
				statement,
				prefix,
				parentID,
				exports,
				inventory,
				supportedHosts,
				unitsByID,
				implicitlyExported,
			) {
				// TypeScript attaches the leading JSDoc of
				// a variable declaration to the statement wrapper.
				addTypeScriptHost(supportedHosts, statement, symbol)
			}
		case shimast.KindClassDeclaration:
			if typeOnlyProjection {
				continue
			}
			name := declarationName(statement.Name())
			for _, publicName := range publicTypeScriptNames(
				statement,
				name,
				exports,
				false,
				implicitlyExported,
			) {
				collectClassCallables(
					statement,
					qualifyTypeScriptName(prefix, publicName),
					parentID,
					inventory,
					supportedHosts,
					unitsByID,
				)
			}
		case shimast.KindModuleDeclaration:
			name := declarationName(statement.Name())
			targets := publicTypeScriptExports(
				statement,
				name,
				exports,
				true,
				implicitlyExported,
			)
			if len(targets) == 0 {
				continue
			}
			addTypeScriptHost(supportedHosts, statement, "type")
			for _, target := range targets {
				identity := qualifyTypeScriptName(prefix, target.Public)
				unit := addTypeScriptUnit(
					inventory,
					unitsByID,
					statement,
					"type",
					identity,
					parentID,
				)
				collectTypeScriptModule(
					statement,
					identity,
					unit.ID,
					inventory,
					supportedHosts,
					unitsByID,
					ambientContext,
					typeOnlyProjection || target.TypeOnly,
				)
			}
		}
	}
}

func collectTypeScriptVariables(
	statement *shimast.Node,
	prefix []string,
	parentID string,
	exports map[string][]exportedName,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
	unitsByID map[string]*evidenceUnit,
	implicitlyExported bool,
) symbolSet {
	variable := statement.AsVariableStatement()
	if variable.DeclarationList == nil {
		return nil
	}
	list := variable.DeclarationList.AsVariableDeclarationList()
	if list.Declarations == nil {
		return nil
	}
	found := symbolSet{}
	for _, declaration := range list.Declarations.Nodes {
		if declaration == nil {
			continue
		}
		value := declaration.AsVariableDeclaration()
		symbol := "property"
		if !shimast.IsBindingPattern(declaration.Name()) &&
			shimast.IsConst(declaration) &&
			isFunctionValue(value.Initializer) {
			symbol = "function"
		}
		for _, binding := range bindingIdentifierNodes(declaration.Name()) {
			name := declarationName(binding)
			targets := publicTypeScriptNames(
				statement,
				name,
				exports,
				false,
				implicitlyExported,
			)
			if len(targets) == 0 {
				continue
			}
			addTypeScriptHost(supportedHosts, declaration, symbol)
			for _, name := range targets {
				unit := addTypeScriptUnit(
					inventory,
					unitsByID,
					binding,
					symbol,
					qualifyTypeScriptName(prefix, name),
					parentID,
				)
				// The binding names the unit, but TypeScript attaches a
				// variable's leading JSDoc to the statement wrapper, so that
				// is where a citation for this unit actually lives.
				inventory.recordUnitNode(unit.ID, statement)
			}
			found[symbol] = true
		}
	}
	return found
}

func collectClassCallables(
	statement *shimast.Node,
	classIdentity []string,
	parentID string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
	unitsByID map[string]*evidenceUnit,
) {
	class := statement.AsClassDeclaration()
	if class.Members == nil {
		return
	}
	for _, member := range class.Members.Nodes {
		if member == nil || !isPublicClassMember(member) {
			continue
		}
		callable := false
		switch member.Kind {
		case shimast.KindMethodDeclaration:
			callable = true
		case shimast.KindPropertyDeclaration:
			if member.ModifierFlags()&shimast.ModifierFlagsAccessor != 0 {
				continue
			}
			property := member.AsPropertyDeclaration()
			callable = isFunctionValue(property.Initializer) ||
				isDirectFunctionType(property.Type)
		}
		if !callable {
			continue
		}
		memberName := declarationName(member.Name())
		if memberName == "" {
			continue
		}
		identity := qualifyTypeScriptName(classIdentity, "prototype", memberName)
		if shimast.GetCombinedModifierFlags(member)&shimast.ModifierFlagsStatic != 0 {
			identity = qualifyTypeScriptName(classIdentity, memberName)
		}
		addTypeScriptUnit(inventory, unitsByID, member, "function", identity, parentID)
		addTypeScriptHost(supportedHosts, member, "function")
	}
}

func isPublicClassMember(node *shimast.Node) bool {
	flags := shimast.GetCombinedModifierFlags(node)
	return flags&shimast.ModifierFlagsPrivate == 0 &&
		flags&shimast.ModifierFlagsProtected == 0
}

func isFunctionValue(node *shimast.Node) bool {
	for node != nil {
		switch node.Kind {
		case shimast.KindArrowFunction, shimast.KindFunctionExpression:
			return true
		case shimast.KindParenthesizedExpression,
			shimast.KindAsExpression,
			shimast.KindSatisfiesExpression,
			shimast.KindNonNullExpression,
			shimast.KindTypeAssertionExpression:
			node = node.Expression()
		default:
			return false
		}
	}
	return false
}

func isDirectFunctionType(node *shimast.Node) bool {
	for node != nil && node.Kind == shimast.KindParenthesizedType {
		parenthesized := node.AsParenthesizedTypeNode()
		if parenthesized == nil {
			return false
		}
		node = parenthesized.Type
	}
	return node != nil && node.Kind == shimast.KindFunctionType
}

func collectTypeScriptModule(
	node *shimast.Node,
	qualified []string,
	parentID string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
	unitsByID map[string]*evidenceUnit,
	ambientContext bool,
	typeOnlyProjection bool,
) {
	if node == nil || node.Kind != shimast.KindModuleDeclaration {
		return
	}
	module := node.AsModuleDeclaration()
	if module.Body == nil {
		return
	}
	switch module.Body.Kind {
	case shimast.KindModuleBlock:
		moduleAmbient := ambientContext ||
			shimast.GetCombinedModifierFlags(node)&shimast.ModifierFlagsAmbient != 0
		collectTypeScriptStatements(
			module.Body.AsModuleBlock().Statements,
			qualified,
			parentID,
			inventory,
			supportedHosts,
			unitsByID,
			moduleAmbient,
			moduleAmbient,
			typeOnlyProjection,
		)
	case shimast.KindModuleDeclaration:
		// `export namespace Outer.Inner {}` is represented as nested module
		// declarations; the inner declaration inherits the outer export.
		name := declarationName(module.Body.Name())
		if name != "" {
			identity := qualifyTypeScriptName(qualified, name)
			addTypeScriptHost(supportedHosts, module.Body, "type")
			unit := addTypeScriptUnit(
				inventory,
				unitsByID,
				module.Body,
				"type",
				identity,
				parentID,
			)
			collectTypeScriptModule(
				module.Body,
				identity,
				unit.ID,
				inventory,
				supportedHosts,
				unitsByID,
				ambientContext ||
					shimast.GetCombinedModifierFlags(node)&shimast.ModifierFlagsAmbient != 0,
				typeOnlyProjection,
			)
		}
	}
}

func collectPropertyMembers(
	members *shimast.NodeList,
	owner []string,
	parentID string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
	unitsByID map[string]*evidenceUnit,
) {
	if members == nil {
		return
	}
	for _, member := range members.Nodes {
		if member == nil || member.Kind != shimast.KindPropertySignature {
			continue
		}
		name := declarationName(member.Name())
		if name == "" {
			continue
		}
		identity := qualifyTypeScriptName(owner, name)
		addTypeScriptUnit(inventory, unitsByID, member, "property", identity, parentID)
		addTypeScriptHost(supportedHosts, member, "property")
	}
}

func addTypeScriptUnit(
	inventory *artifactInventory,
	unitsByID map[string]*evidenceUnit,
	node *shimast.Node,
	symbol string,
	identity []string,
	parentID string,
) *evidenceUnit {
	target := strings.Join(identity, ".")
	id := "typescript:" + inventory.Path + ":" + symbol + ":" + encodeTypeScriptIdentity(identity)
	// Recorded before the dedupe below, so a merged identity keeps every
	// declaration that spells it. `interface I` beside `namespace I` is one
	// unit and two nodes, and a rule asking where that unit's JSDoc may live
	// has to see both.
	inventory.recordUnitNode(id, node)
	if unit := unitsByID[id]; unit != nil {
		return unit
	}
	unit := &evidenceUnit{
		ID:       id,
		ParentID: parentID,
		Target:   target,
		Identity: append([]string{}, identity...),
		Type:     artifactTypeScript,
		Symbol:   symbol,
		Path:     inventory.Path,
		Line:     lineAtNode(inventory.Path, node),
		Readable: "TypeScript " + symbol + " '" + target + "'",
	}
	unitsByID[id] = unit
	inventory.Units = append(inventory.Units, unit)
	return unit
}

func addTypeScriptHost(
	hosts map[*shimast.Node]symbolSet,
	node *shimast.Node,
	symbol string,
) {
	if node == nil {
		return
	}
	if hosts[node] == nil {
		hosts[node] = symbolSet{}
	}
	hosts[node][symbol] = true
}

// lineAtNode stores a byte offset until declarations are scanned against the
// complete source text. A position inside the name is on the declaration
// itself, while both the parent and name full starts may include leading trivia.
func lineAtNode(_ string, node *shimast.Node) int {
	if node == nil {
		return 0
	}
	if name := node.Name(); name != nil && name.End() > 0 {
		return name.End() - 1
	}
	return node.Pos()
}

func collectTypeScriptDeclarations(
	file *shimast.SourceFile,
	path string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]symbolSet,
) {
	type docHost struct {
		node  *shimast.Node
		hosts symbolSet
	}
	docs := map[string]docHost{}
	walkTypeScriptNode(file.AsNode(), func(node *shimast.Node) {
		for _, doc := range node.JSDoc(file) {
			if doc == nil {
				continue
			}
			key := decimal(doc.Pos()) + ":" + decimal(doc.End())
			candidate := docHost{node: doc, hosts: supportedHosts[node]}
			current, exists := docs[key]
			if !exists {
				docs[key] = candidate
				continue
			}
			for symbol := range candidate.hosts {
				if current.hosts == nil {
					current.hosts = symbolSet{}
				}
				current.hosts[symbol] = true
			}
			docs[key] = current
		}
	})
	keys := make([]string, 0, len(docs))
	for key := range docs {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(left int, right int) bool {
		leftNode := docs[keys[left]].node
		rightNode := docs[keys[right]].node
		if leftNode.Pos() != rightNode.Pos() {
			return leftNode.Pos() < rightNode.Pos()
		}
		return leftNode.End() < rightNode.End()
	})
	content := file.Text()
	sequence := 0
	for _, key := range keys {
		entry := docs[key]
		if entry.node.Pos() < 0 || entry.node.End() > len(content) || entry.node.Pos() >= entry.node.End() {
			continue
		}
		baseLine := lineAt(content, entry.node.Pos())
		for _, parsed := range parseDeclarations(content[entry.node.Pos():entry.node.End()]) {
			sequence++
			inventory.Declarations = append(inventory.Declarations, &evidenceDeclaration{
				ID:       "typescript:" + path + ":" + decimal(baseLine+parsed.LineOffset) + ":" + decimal(sequence),
				Type:     artifactTypeScript,
				Tag:      parsed.Tag,
				Target:   parsed.Target,
				Reason:   parsed.Reason,
				Hosts:    entry.hosts,
				Path:     path,
				Line:     baseLine + parsed.LineOffset,
				Sequence: sequence,
			})
		}
	}
	for _, unit := range inventory.Units {
		// TypeScript AST positions are byte offsets; translate them only after
		// the complete source text is available.
		unit.Line = lineAt(content, unit.Line)
	}
}

func walkTypeScriptNode(node *shimast.Node, visit func(*shimast.Node)) {
	if node == nil {
		return
	}
	visit(node)
	node.ForEachChild(func(child *shimast.Node) bool {
		walkTypeScriptNode(child, visit)
		return false
	})
}

type exportedName struct {
	Public   string
	TypeOnly bool
}

func collectLocalExportNames(
	statements *shimast.NodeList,
) map[string][]exportedName {
	exports := map[string][]exportedName{}
	if statements == nil {
		return exports
	}
	for _, statement := range statements.Nodes {
		if statement == nil || statement.Kind != shimast.KindExportDeclaration {
			continue
		}
		declaration := statement.AsExportDeclaration()
		if declaration == nil ||
			declaration.ModuleSpecifier != nil ||
			declaration.ExportClause == nil ||
			declaration.ExportClause.Kind != shimast.KindNamedExports {
			continue
		}
		named := declaration.ExportClause.AsNamedExports()
		if named == nil || named.Elements == nil {
			continue
		}
		for _, element := range named.Elements.Nodes {
			if element == nil || element.Kind != shimast.KindExportSpecifier {
				continue
			}
			specifier := element.AsExportSpecifier()
			if specifier == nil {
				continue
			}
			localNode := specifier.PropertyName
			if localNode == nil {
				localNode = specifier.Name()
			}
			local := declarationName(localNode)
			public := declarationName(specifier.Name())
			if local == "" || public == "" || public == "default" {
				continue
			}
			exports[local] = append(exports[local], exportedName{
				Public:   public,
				TypeOnly: declaration.IsTypeOnly || specifier.IsTypeOnly,
			})
		}
	}
	return exports
}

func publicTypeScriptNames(
	node *shimast.Node,
	local string,
	exports map[string][]exportedName,
	allowTypeOnly bool,
	implicitlyExported bool,
) []string {
	projected := publicTypeScriptExports(
		node,
		local,
		exports,
		allowTypeOnly,
		implicitlyExported,
	)
	result := make([]string, 0, len(projected))
	for _, exported := range projected {
		result = append(result, exported.Public)
	}
	return result
}

func publicTypeScriptExports(
	node *shimast.Node,
	local string,
	exports map[string][]exportedName,
	allowTypeOnly bool,
	implicitlyExported bool,
) []exportedName {
	if local == "" {
		return nil
	}
	names := map[string]exportedName{}
	if implicitlyExported || isSyntacticallyExported(node) {
		names[local] = exportedName{Public: local}
	}
	for _, exported := range exports[local] {
		if exported.TypeOnly && !allowTypeOnly {
			continue
		}
		current, exists := names[exported.Public]
		if !exists || current.TypeOnly && !exported.TypeOnly {
			names[exported.Public] = exported
		}
	}
	result := make([]string, 0, len(names))
	for name := range names {
		result = append(result, name)
	}
	sort.Strings(result)
	projected := make([]exportedName, 0, len(result))
	for _, name := range result {
		projected = append(projected, names[name])
	}
	return projected
}

func isSyntacticallyExported(node *shimast.Node) bool {
	return node != nil && shimast.GetCombinedModifierFlags(node)&shimast.ModifierFlagsExport != 0
}

func declarationName(node *shimast.Node) string {
	if node == nil {
		return ""
	}
	switch node.Kind {
	case shimast.KindIdentifier,
		shimast.KindStringLiteral,
		shimast.KindNumericLiteral:
		name := node.Text()
		if containsWhitespace(name) {
			return ""
		}
		return name
	default:
		return ""
	}
}

func bindingIdentifierNodes(node *shimast.Node) []*shimast.Node {
	if node == nil {
		return nil
	}
	if declarationName(node) != "" {
		return []*shimast.Node{node}
	}
	if !shimast.IsBindingPattern(node) {
		return nil
	}
	pattern := node.AsBindingPattern()
	if pattern == nil || pattern.Elements == nil {
		return nil
	}
	nodes := []*shimast.Node{}
	for _, element := range pattern.Elements.Nodes {
		if element == nil || element.Kind != shimast.KindBindingElement {
			continue
		}
		nodes = append(nodes, bindingIdentifierNodes(element.Name())...)
	}
	return nodes
}

func qualifyTypeScriptName(prefix []string, names ...string) []string {
	qualified := make([]string, 0, len(prefix)+len(names))
	qualified = append(qualified, prefix...)
	qualified = append(qualified, names...)
	return qualified
}

func encodeTypeScriptIdentity(identity []string) string {
	var builder strings.Builder
	for _, segment := range identity {
		builder.WriteString(decimal(len(segment)))
		builder.WriteByte(':')
		builder.WriteString(segment)
		builder.WriteByte(';')
	}
	return builder.String()
}
