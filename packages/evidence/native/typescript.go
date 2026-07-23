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
	inventory := &artifactInventory{Path: path, Type: artifactTypeScript}
	supportedHosts := map[*shimast.Node]string{}
	unitIDs := map[string]bool{}
	collectTypeScriptStatements(
		file.Statements,
		"",
		inventory,
		supportedHosts,
		unitIDs,
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
	prefix string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]string,
	unitIDs map[string]bool,
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
			targets := publicTypeScriptNames(statement, name, exports, true)
			if len(targets) == 0 {
				continue
			}
			supportedHosts[statement] = "type"
			for _, name := range targets {
				target := qualifyTypeScriptName(prefix, name)
				addTypeScriptUnit(inventory, unitIDs, statement, "type", target)
				collectPropertyMembers(
					statement.AsInterfaceDeclaration().Members,
					target,
					inventory,
					supportedHosts,
					unitIDs,
				)
			}
		case shimast.KindTypeAliasDeclaration:
			name := declarationName(statement.Name())
			if name == "" {
				continue
			}
			targets := publicTypeScriptNames(statement, name, exports, true)
			if len(targets) == 0 {
				continue
			}
			supportedHosts[statement] = "type"
			alias := statement.AsTypeAliasDeclaration()
			for _, name := range targets {
				target := qualifyTypeScriptName(prefix, name)
				addTypeScriptUnit(inventory, unitIDs, statement, "type", target)
				if alias.Type != nil && alias.Type.Kind == shimast.KindTypeLiteral {
					collectPropertyMembers(
						alias.Type.AsTypeLiteralNode().Members,
						target,
						inventory,
						supportedHosts,
						unitIDs,
					)
				}
			}
		case shimast.KindFunctionDeclaration:
			name := declarationName(statement.Name())
			if name == "" {
				continue
			}
			targets := publicTypeScriptNames(statement, name, exports, false)
			if len(targets) == 0 {
				continue
			}
			supportedHosts[statement] = "function"
			for _, name := range targets {
				addTypeScriptUnit(
					inventory,
					unitIDs,
					statement,
					"function",
					qualifyTypeScriptName(prefix, name),
				)
			}
		case shimast.KindVariableStatement:
			if collectFunctionVariables(
				statement,
				prefix,
				exports,
				inventory,
				supportedHosts,
				unitIDs,
			) {
				// TypeScript attaches the leading JSDoc of
				// `export const fn = () => {}` to the statement wrapper.
				supportedHosts[statement] = "function"
			}
		case shimast.KindClassDeclaration:
			name := declarationName(statement.Name())
			for _, publicName := range publicTypeScriptNames(statement, name, exports, false) {
				collectClassCallables(
					statement,
					qualifyTypeScriptName(prefix, publicName),
					inventory,
					supportedHosts,
					unitIDs,
				)
			}
		case shimast.KindModuleDeclaration:
			name := declarationName(statement.Name())
			targets := publicTypeScriptNames(statement, name, exports, false)
			if len(targets) == 0 {
				continue
			}
			for _, publicName := range targets {
				collectTypeScriptModule(
					statement,
					qualifyTypeScriptName(prefix, publicName),
					inventory,
					supportedHosts,
					unitIDs,
				)
			}
		}
	}
}

func collectFunctionVariables(
	statement *shimast.Node,
	prefix string,
	exports map[string][]exportedName,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]string,
	unitIDs map[string]bool,
) bool {
	variable := statement.AsVariableStatement()
	if variable.DeclarationList == nil {
		return false
	}
	list := variable.DeclarationList.AsVariableDeclarationList()
	if list.Declarations == nil {
		return false
	}
	found := false
	for _, declaration := range list.Declarations.Nodes {
		if declaration == nil || !shimast.IsConst(declaration) {
			continue
		}
		value := declaration.AsVariableDeclaration()
		if !isFunctionValue(value.Initializer) {
			continue
		}
		name := declarationName(declaration.Name())
		if name == "" {
			continue
		}
		targets := publicTypeScriptNames(
			statement,
			name,
			exports,
			false,
		)
		if len(targets) == 0 {
			continue
		}
		supportedHosts[declaration] = "function"
		for _, name := range targets {
			addTypeScriptUnit(
				inventory,
				unitIDs,
				declaration,
				"function",
				qualifyTypeScriptName(prefix, name),
			)
		}
		found = true
	}
	return found
}

func collectClassCallables(
	statement *shimast.Node,
	classTarget string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]string,
	unitIDs map[string]bool,
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
		target := classTarget + ".prototype." + memberName
		if shimast.GetCombinedModifierFlags(member)&shimast.ModifierFlagsStatic != 0 {
			target = classTarget + "." + memberName
		}
		addTypeScriptUnit(inventory, unitIDs, member, "function", target)
		supportedHosts[member] = "function"
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
	qualified string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]string,
	unitIDs map[string]bool,
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
		collectTypeScriptStatements(
			module.Body.AsModuleBlock().Statements,
			qualified,
			inventory,
			supportedHosts,
			unitIDs,
		)
	case shimast.KindModuleDeclaration:
		// `export namespace Outer.Inner {}` is represented as nested module
		// declarations; the inner declaration inherits the outer export.
		name := declarationName(module.Body.Name())
		if name != "" {
			collectTypeScriptModule(
				module.Body,
				qualifyTypeScriptName(qualified, name),
				inventory,
				supportedHosts,
				unitIDs,
			)
		}
	}
}

func collectPropertyMembers(
	members *shimast.NodeList,
	owner string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]string,
	unitIDs map[string]bool,
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
		target := owner + "." + name
		addTypeScriptUnit(inventory, unitIDs, member, "property", target)
		supportedHosts[member] = "property"
	}
}

func addTypeScriptUnit(
	inventory *artifactInventory,
	unitIDs map[string]bool,
	node *shimast.Node,
	symbol string,
	target string,
) {
	id := "typescript:" + inventory.Path + ":" + symbol + ":" + target
	if unitIDs[id] {
		return
	}
	unitIDs[id] = true
	inventory.Units = append(inventory.Units, &evidenceUnit{
		ID:       id,
		Target:   target,
		Type:     artifactTypeScript,
		Symbol:   symbol,
		Path:     inventory.Path,
		Line:     lineAtNode(inventory.Path, node),
		Readable: "TypeScript " + symbol + " '" + target + "'",
	})
}

// lineAtNode is filled accurately when declarations are scanned against the
// source text. Unit line numbers are diagnostic context only, so a zero value
// remains safe until then.
func lineAtNode(_ string, node *shimast.Node) int {
	if node == nil {
		return 0
	}
	return node.Pos()
}

func collectTypeScriptDeclarations(
	file *shimast.SourceFile,
	path string,
	inventory *artifactInventory,
	supportedHosts map[*shimast.Node]string,
) {
	type docHost struct {
		node *shimast.Node
		host string
	}
	docs := map[string]docHost{}
	walkTypeScriptNode(file.AsNode(), func(node *shimast.Node) {
		for _, doc := range node.JSDoc(file) {
			if doc == nil {
				continue
			}
			key := decimal(doc.Pos()) + ":" + decimal(doc.End())
			candidate := docHost{node: doc, host: supportedHosts[node]}
			current, exists := docs[key]
			if !exists || (current.host == "" && candidate.host != "") {
				docs[key] = candidate
			}
		}
	})
	keys := make([]string, 0, len(docs))
	for key := range docs {
		keys = append(keys, key)
	}
	sort.Strings(keys)
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
				Tag:      parsed.Tag,
				Target:   normalizeTarget(parsed.Target),
				Reason:   parsed.Reason,
				Host:     entry.host,
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
) []string {
	if local == "" {
		return nil
	}
	names := map[string]bool{}
	if isSyntacticallyExported(node) {
		names[local] = true
	}
	for _, exported := range exports[local] {
		if exported.TypeOnly && !allowTypeOnly {
			continue
		}
		names[exported.Public] = true
	}
	result := make([]string, 0, len(names))
	for name := range names {
		result = append(result, name)
	}
	sort.Strings(result)
	return result
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

func qualifyTypeScriptName(prefix string, name string) string {
	if prefix == "" {
		return name
	}
	return prefix + "." + name
}
