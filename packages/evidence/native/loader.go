package evidence

import (
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimcore "github.com/microsoft/typescript-go/shim/core"
	shimparser "github.com/microsoft/typescript-go/shim/parser"
)

// typeScriptLoader materializes TypeScript inventories for a reference
// population, from the Program where possible and from disk where necessary.
//
// Disk parsing is not an optimization detail, it is the requirement. A package
// symbol that nothing imports is absent from the Program by definition, and
// that symbol is precisely the one an obligation needs to name — an evidence
// graph exists to report the operation the frontend never called.
type typeScriptLoader struct {
	root     string
	program  map[string]*artifactInventory
	parsed   map[string]*artifactInventory
	resolved map[string]string
}

func newTypeScriptLoader(
	root string,
	program map[string]*artifactInventory,
) *typeScriptLoader {
	return &typeScriptLoader{
		root:     strings.ReplaceAll(root, "\\", "/"),
		program:  program,
		parsed:   map[string]*artifactInventory{},
		resolved: map[string]string{},
	}
}

// inventory returns the scanned form of a project-relative TypeScript file.
//
// The Program's copy wins when it exists so that a file under edit is read as
// the editor has it, not as the disk last saw it.
func (loader *typeScriptLoader) inventory(relative string) *artifactInventory {
	if relative == "" {
		return nil
	}
	if inventory := loader.program[relative]; inventory != nil {
		return inventory
	}
	if inventory, cached := loader.parsed[relative]; cached {
		return inventory
	}
	loader.parsed[relative] = loader.parse(relative)
	return loader.parsed[relative]
}

func (loader *typeScriptLoader) parse(relative string) *artifactInventory {
	content, err := os.ReadFile(path.Join(loader.root, relative))
	if err != nil {
		return nil
	}
	kind := shimcore.ScriptKindTS
	if strings.HasSuffix(strings.ToLower(relative), ".tsx") {
		kind = shimcore.ScriptKindTSX
	}
	file := shimparser.ParseSourceFile(
		shimast.SourceFileParseOptions{
			FileName: path.Join(loader.root, relative),
		},
		string(content),
		kind,
	)
	if file == nil {
		return nil
	}
	return scanTypeScriptInventory(relative, file)
}

// exists reports whether a project-relative TypeScript file can be read at all,
// without paying to scan it.
func (loader *typeScriptLoader) exists(relative string) bool {
	if loader.program[relative] != nil {
		return true
	}
	info, err := os.Stat(path.Join(loader.root, relative))
	return err == nil && !info.IsDir()
}

// resolve maps a module specifier written in one file to a project-relative
// path, trying the same candidates TypeScript would.
func (loader *typeScriptLoader) resolve(from string, specifier string) string {
	key := from + "\x00" + specifier
	if cached, exists := loader.resolved[key]; exists {
		return cached
	}
	loader.resolved[key] = loader.resolveUncached(from, specifier)
	return loader.resolved[key]
}

func (loader *typeScriptLoader) resolveUncached(
	from string,
	specifier string,
) string {
	if strings.HasPrefix(specifier, "./") || strings.HasPrefix(specifier, "../") {
		base := path.Clean(path.Join(path.Dir(from), specifier))
		for _, candidate := range moduleCandidates(base) {
			if loader.exists(candidate) {
				return candidate
			}
		}
		return ""
	}
	if strings.HasPrefix(specifier, "/") {
		return ""
	}
	return loader.resolvePackage(specifier)
}

// resolvePackage finds the declaration entry of an installed package.
//
// The entry comes from the `types` condition of an `exports` map, then
// `typesVersions`, then `types` or `typings` — never `main`, which names the
// JavaScript a consumer runs rather than the declarations a citation addresses.
func (loader *typeScriptLoader) resolvePackage(specifier string) string {
	name, subpath := splitPackageSpecifier(specifier)
	if name == "" {
		return ""
	}
	directory := path.Join("node_modules", name)
	manifest := readPackageManifest(loader.root, path.Join(directory, "package.json"))
	entry := packageTypeEntry(manifest, subpath)
	if entry == "" {
		if subpath == "" {
			return ""
		}
		entry = subpath
	}
	for _, candidate := range moduleCandidates(path.Join(directory, entry)) {
		if loader.exists(candidate) {
			return candidate
		}
	}
	return ""
}

// packageEntryModule resolves the declaration entry a package reference starts
// its traversal from.
func (loader *typeScriptLoader) packageEntryModule(name string) string {
	return loader.resolvePackage(name)
}

// walk lists the project-relative TypeScript files below a directory.
//
// A package's files are enumerated from disk for the same reason its entry is
// parsed from disk: the ones an obligation most needs to name are precisely the
// ones nothing imported, so the Program cannot be the source of truth.
func (loader *typeScriptLoader) walk(base string) []string {
	root := path.Join(loader.root, base)
	found := []string{}
	err := filepath.WalkDir(root, func(current string, entry fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if entry.IsDir() {
			if entry.Name() == "node_modules" && filepath.ToSlash(current) != root {
				return filepath.SkipDir
			}
			return nil
		}
		relative, ok := relativeProjectPath(loader.root, filepath.ToSlash(current))
		if !ok || !isTypeScriptPath(relative) {
			return nil
		}
		found = append(found, relative)
		return nil
	})
	if err != nil {
		return nil
	}
	sort.Strings(found)
	return found
}

// referenceBase is the directory a reference's entry and globs resolve against.
func referenceBase(reference referenceSpec) string {
	if reference.Package == "" {
		return ""
	}
	return path.Join("node_modules", reference.Package)
}
