import path from "node:path";

import type { IEvidInventory } from "../../structures/IEvidInventory";
import type { IEvidPublicAddress } from "../../structures/IEvidPublicAddress";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidSourceRoot } from "../../structures/IEvidSourceRoot";
import type { IEvidEcmaScriptBinding } from "./IEvidEcmaScriptBinding";
import type { IEvidEcmaScriptFileAnalysis } from "./IEvidEcmaScriptFileAnalysis";
import type { IEvidEcmaScriptModule } from "./IEvidEcmaScriptModule";
import type { IEvidEcmaScriptResolution } from "./IEvidEcmaScriptResolution";
import type { EvidEcmaScriptType } from "./EvidEcmaScriptType";
import { EvidSourcePath } from "../../internal/EvidSourcePath";

/**
 * Publishes local ECMAScript declarations that have a static public export.
 *
 * `EvidEcmaScriptAdapter` constructs this resolver after every selected source has
 * been scanned. It follows local exports and re-exports, records each resulting
 * public address in the inventory, and reports resolution failures so an
 * incomplete export graph cannot reduce the coverage population silently.
 */
export class EvidEcmaScriptExportResolver {
  /**
   * Scanned module data by stable source ID.
   *
   * Resolution follows these records instead of reparsing source files, so each
   * export path refers to the same declaration inventory gathered by the adapter.
   */
  private readonly modules = new Map<string, IEvidEcmaScriptModule>();

  /**
   * Normalized physical and logical locations mapped to their source IDs.
   *
   * A source may have aliases; retaining all locations lets an import resolve
   * through either address while ambiguity remains detectable.
   */
  private readonly locations = new Map<string, Set<string>>();

  /**
   * Cached module-specifier targets, including known failures.
   *
   * Caching undefined failures prevents repeated traversal from emitting the
   * same diagnostic for an import edge.
   */
  private readonly targets = new Map<string, string | undefined>();

  /**
   * Cached binding resolutions for source and exported-name pairs.
   *
   * Publication may visit a re-export from several public paths, but each pair
   * has one resolution result within this immutable source snapshot.
   */
  private readonly resolutions = new Map<string, IEvidEcmaScriptResolution>();

  /**
   * Diagnostic identities already emitted by this resolver.
   *
   * Several export paths can reach one invalid edge; the inventory needs one
   * actionable error rather than a copy for every traversal.
   */
  private readonly reported = new Set<string>();

  /**
   * Indexes a complete set of scanned ECMAScript modules for publication.
   *
   * The adapter supplies declarations before any reachability filtering. The
   * source root and language type define supported import targets and extension
   * candidates, while the inventory receives addresses and diagnostics.
   */
  public constructor(
    analyses: IEvidEcmaScriptFileAnalysis[],
    private readonly inventory: IEvidInventory,
    private readonly root: IEvidSourceRoot,
    private readonly type: EvidEcmaScriptType,
  ) {
    for (const analysis of analyses) {
      const module: IEvidEcmaScriptModule = {
        source: analysis.source,
        units: analysis.units,
        excludedRoots: new Set(analysis.excludedRoots),
        exports: analysis.exports,
        imports: new Map(
          analysis.imports.map((entry) => [entry.localName, entry]),
        ),
        names: new Set(
          analysis.exports.flatMap((entry) =>
            entry.publicName === undefined ? [] : [entry.publicName],
          ),
        ),
      };
      this.modules.set(analysis.source.id, module);
      for (const location of this.sourceLocations(analysis.source)) {
        let ids = this.locations.get(location);
        if (ids === undefined) {
          ids = new Set<string>();
          this.locations.set(location, ids);
        }
        ids.add(analysis.source.id);
      }
    }
    // Star exports contribute names before recursive binding resolution begins.
    // Without this fixed point, a transitive `export *` can be omitted entirely.
    this.expandStars();
  }

  /**
   * Materializes public addresses and returns the reachable semantic unit IDs.
   *
   * The adapter uses the returned set to remove declarations that have no public
   * export. Addresses remain in the shared inventory because aliases can expose
   * one unit through several public module paths.
   */
  public publish(): Set<string> {
    const published = new Set<string>();
    for (const module of this.modules.values()) {
      const names = Array.from(module.names).sort((x, y) =>
        x.localeCompare(y, "en"),
      );
      for (const name of names) {
        const resolution = this.resolve(module.source.id, name);
        if (
          resolution.bindings.length === 0 &&
          resolution.cyclic &&
          !resolution.excluded
        )
          this.problem(
            module.source,
            `Export '${name}' resolves only through a declaration-free cycle.`,
            "Add a supported declaration to the cycle or remove the cyclic export.",
            JSON.stringify([module.source.id, name, "cycle"]),
          );
        for (const binding of resolution.bindings)
          this.publishBinding(
            module.source,
            binding,
            [name],
            new Set<string>(),
            published,
          );
      }
    }
    return published;
  }

  /**
   * Adds names inherited through transitive star exports to every module.
   *
   * Repeating until no name changes reaches a fixed point even when barrel files
   * form a cycle. `default` is excluded because ECMAScript star exports omit it.
   */
  private expandStars(): void {
    let changed = true;
    while (changed) {
      changed = false;
      for (const module of this.modules.values())
        for (const edge of module.exports) {
          if (edge.kind !== "star" || edge.specifier === undefined) continue;
          const target = this.target(module.source, edge.specifier);
          const dependency =
            target === undefined ? undefined : this.modules.get(target);
          if (dependency === undefined) continue;
          for (const name of dependency.names)
            if (name !== "default" && !module.names.has(name)) {
              module.names.add(name);
              changed = true;
            }
        }
    }
  }

  /**
   * Resolves one exported name and caches the result for later publication.
   *
   * Recursive traversal receives a fresh cycle-tracking set; only a completed
   * resolution is memoized because its bindings do not depend on the caller path.
   */
  private resolve(sourceId: string, name: string): IEvidEcmaScriptResolution {
    const key = JSON.stringify([sourceId, name]);
    const cached = this.resolutions.get(key);
    if (cached !== undefined) return cached;
    const resolved = this.resolveFrom(sourceId, name, new Set<string>());
    this.resolutions.set(key, resolved);
    return resolved;
  }

  /**
   * Follows export edges from a source/name pair to declaration bindings.
   *
   * The visited set is scoped to this traversal so circular re-exports become an
   * incomplete cycle result without suppressing bindings found on other paths.
   */
  private resolveFrom(
    sourceId: string,
    name: string,
    visited: Set<string>,
  ): IEvidEcmaScriptResolution {
    const key = JSON.stringify([sourceId, name]);
    if (visited.has(key))
      return { bindings: [], excluded: false, cyclic: true };
    const module = this.modules.get(sourceId);
    if (module === undefined)
      return { bindings: [], excluded: false, cyclic: false };
    visited.add(key);
    const output: IEvidEcmaScriptResolution = {
      bindings: [],
      excluded: false,
      cyclic: false,
    };
    // Named exports override star-export lookup; default is never provided by a
    // star export, even when the module has no explicit default edge.
    const explicit = module.exports.filter(
      (entry) => entry.publicName === name && entry.kind !== "star",
    );
    const edges =
      explicit.length !== 0 || name === "default"
        ? explicit
        : module.exports.filter((entry) => entry.kind === "star");
    for (const edge of edges) {
      if (edge.kind === "local" && edge.localName !== undefined) {
        const imported = module.imports.get(edge.localName);
        if (imported === undefined) {
          const declared = module.units.some(
            (entry) => entry.root === edge.localName,
          );
          if (declared)
            this.addBinding(output.bindings, {
              sourceId,
              localName: edge.localName,
              typeOnly: edge.typeOnly,
            });
          else if (module.excludedRoots.has(edge.localName))
            output.excluded = true;
          else
            this.problem(
              module.source,
              `The exported binding '${edge.localName}' has no supported declaration in this module.`,
              "Export a supported local declaration or correct the export name.",
              key,
            );
          continue;
        }
        const target = this.target(module.source, imported.specifier);
        if (target === undefined) continue;
        if (imported.namespace)
          this.addBinding(output.bindings, {
            sourceId: target,
            typeOnly: edge.typeOnly || imported.typeOnly,
          });
        else {
          const importedName = imported.importedName ?? edge.localName;
          const resolved = this.resolveFrom(target, importedName, visited);
          if (
            resolved.bindings.length === 0 &&
            !resolved.excluded &&
            !this.exported(target, importedName)
          )
            this.problem(
              module.source,
              `Module '${imported.specifier}' has no supported export named '${importedName}'.`,
              "Correct the imported name or include its supported declaration in the source snapshot.",
              JSON.stringify([key, imported.specifier, importedName]),
            );
          this.mergeState(output, resolved);
          for (const binding of resolved.bindings)
            this.addBinding(output.bindings, {
              ...binding,
              typeOnly: binding.typeOnly || edge.typeOnly || imported.typeOnly,
            });
        }
      } else if (
        edge.kind === "named" &&
        edge.specifier !== undefined &&
        edge.importedName !== undefined
      ) {
        const target = this.target(module.source, edge.specifier);
        if (target === undefined) continue;
        const resolved = this.resolveFrom(target, edge.importedName, visited);
        if (
          resolved.bindings.length === 0 &&
          !resolved.excluded &&
          !this.exported(target, edge.importedName)
        )
          this.problem(
            module.source,
            `Module '${edge.specifier}' has no supported export named '${edge.importedName}'.`,
            "Correct the reexported name or include its supported declaration in the source snapshot.",
            JSON.stringify([key, edge.specifier, edge.importedName]),
          );
        this.mergeState(output, resolved);
        for (const binding of resolved.bindings)
          this.addBinding(output.bindings, {
            ...binding,
            typeOnly: binding.typeOnly || edge.typeOnly,
          });
      } else if (edge.kind === "namespace" && edge.specifier !== undefined) {
        const target = this.target(module.source, edge.specifier);
        if (target !== undefined)
          this.addBinding(output.bindings, {
            sourceId: target,
            typeOnly: edge.typeOnly,
          });
      } else if (edge.kind === "star" && edge.specifier !== undefined) {
        const target = this.target(module.source, edge.specifier);
        if (target === undefined) continue;
        const resolved = this.resolveFrom(target, name, visited);
        this.mergeState(output, resolved);
        for (const binding of resolved.bindings)
          this.addBinding(output.bindings, {
            ...binding,
            typeOnly: binding.typeOnly || edge.typeOnly,
          });
      }
    }
    visited.delete(key);
    return output;
  }

  /**
   * Converts a resolved binding into addresses under one exported prefix.
   *
   * Namespace bindings recursively publish their target module's named exports.
   * The visited module set stops namespace cycles while preserving independent
   * paths that reach the same declaration.
   */
  private publishBinding(
    entry: IEvidSourceFile,
    binding: IEvidEcmaScriptBinding,
    prefix: string[],
    visited: Set<string>,
    published: Set<string>,
  ): void {
    const module = this.modules.get(binding.sourceId);
    if (module === undefined) return;
    if (binding.localName === undefined) {
      if (visited.has(binding.sourceId)) return;
      const nested = new Set(visited);
      nested.add(binding.sourceId);
      for (const name of Array.from(module.names).sort((x, y) =>
        x.localeCompare(y, "en"),
      ))
        for (const child of this.resolve(binding.sourceId, name).bindings)
          this.publishBinding(
            entry,
            {
              ...child,
              typeOnly: child.typeOnly || binding.typeOnly,
            },
            [...prefix, name],
            nested,
            published,
          );
      return;
    }
    for (const owned of module.units) {
      if (owned.root !== binding.localName) continue;
      if (binding.typeOnly && !owned.typeSpace) continue;
      const address: IEvidPublicAddress = {
        unitId: owned.unit.id,
        file: "",
        segments: [...prefix, ...owned.suffix],
      };
      for (const source of entry.addresses) {
        address.file = source.absolute;
        this.inventory.addresses.push({ ...address });
      }
      published.add(owned.unit.id);
    }
  }

  /**
   * Adds a distinct declaration binding while combining type-only restrictions.
   *
   * A binding reachable through a value export must remain publishable in value
   * space, so the merged flag is true only when every path is type-only.
   */
  private addBinding(
    output: IEvidEcmaScriptBinding[],
    binding: IEvidEcmaScriptBinding,
  ): void {
    const previous = output.find(
      (entry) =>
        entry.sourceId === binding.sourceId &&
        entry.localName === binding.localName,
    );
    if (previous === undefined) output.push(binding);
    else previous.typeOnly = previous.typeOnly && binding.typeOnly;
  }

  /**
   * Carries failure state from a nested resolution to its caller.
   *
   * Bindings alone cannot distinguish an excluded declaration from a missing one,
   * and cycles must remain visible until publication can diagnose an empty cycle.
   */
  private mergeState(
    output: IEvidEcmaScriptResolution,
    resolved: IEvidEcmaScriptResolution,
  ): void {
    output.excluded ||= resolved.excluded;
    output.cyclic ||= resolved.cyclic;
  }

  /**
   * Reports whether a module declares an export name before resolving its binding.
   *
   * Callers use this to avoid diagnosing a recursive or excluded path as a
   * missing export when the target module did declare the requested name.
   */
  private exported(sourceId: string, name: string): boolean {
    const module = this.modules.get(sourceId);
    return module !== undefined && module.names.has(name);
  }

  /**
   * Resolves a supported local module specifier to one selected source ID.
   *
   * Resolution accepts physical and logical source locations but rejects package
   * semantics, root escapes, absent files, and aliases that identify multiple
   * physical sources. Those cases make the inventory incomplete.
   */
  private target(
    source: IEvidSourceFile,
    specifier: string,
  ): string | undefined {
    const key = JSON.stringify([source.id, specifier]);
    if (this.targets.has(key)) return this.targets.get(key);
    const request = specifier.replaceAll("\\", "/");
    if (!request.startsWith(".") && !this.absolute(request)) {
      this.problem(
        source,
        `Package export '${specifier}' requires unsupported package-resolution semantics.`,
        "Use a relative module inside the declared source root until package exports are supported.",
        key,
      );
      this.targets.set(key, undefined);
      return undefined;
    }
    // Keep root-escaping candidates separate from absent ones so diagnostics tell
    // users whether the dependency must be moved or added to the source snapshot.
    const found = new Set<string>();
    let outside = false;
    for (const location of this.sourceLocations(source)) {
      const base = this.absolute(request)
        ? this.locationKey(request)
        : this.locationKey(
            path.posix.join(path.posix.dirname(location), request),
          );
      for (const candidate of this.candidates(base))
        for (const id of this.locations.get(candidate) ?? []) {
          const dependency = this.modules.get(id)?.source;
          if (
            !EvidSourcePath.contains(
              this.locationKey(this.root.absolute),
              candidate,
            ) ||
            (dependency !== undefined && !this.insidePhysicalRoot(dependency))
          )
            outside = true;
          else found.add(id);
        }
    }
    const target = found.size === 1 ? Array.from(found)[0] : undefined;
    const escaped = found.size === 0 && outside;
    if (escaped)
      this.problem(
        source,
        `Module '${specifier}' leaves the declared source root.`,
        "Move the dependency inside the configured root or declare a reference rooted at its actual source tree.",
        key,
      );
    if (target === undefined)
      if (!escaped)
        this.problem(
          source,
          found.size === 0
            ? `Module '${specifier}' is absent from the complete source snapshot.`
            : `Module '${specifier}' resolves to more than one physical source.`,
          found.size === 0
            ? "Include the dependency in the configured source population or repair the module path."
            : "Remove the ambiguous source aliases or use one unambiguous module path.",
          key,
        );
    this.targets.set(key, target);
    return target;
  }

  /**
   * Checks whether a selected source remains under an optional physical root.
   *
   * Logical aliases may lie under the configured address root while their actual
   * file is elsewhere; physical-root selection forbids that escape.
   */
  private insidePhysicalRoot(source: IEvidSourceFile): boolean {
    return (
      this.root.physical === undefined ||
      EvidSourcePath.contains(this.root.physical, source.physicalPath)
    );
  }

  /**
   * Returns normalized physical and logical locations for one selected source.
   *
   * Duplicates are removed because the physical path may also be one of the
   * logical addresses supplied by the source snapshot.
   */
  private sourceLocations(source: IEvidSourceFile): string[] {
    return Array.from(
      new Set([
        this.locationKey(source.physicalPath),
        ...source.addresses.map((entry) => this.locationKey(entry.absolute)),
      ]),
    );
  }

  /**
   * Identifies POSIX and Windows drive-qualified module requests.
   *
   * Resolver input is slash-normalized before this check, so Windows separators
   * cannot change whether a request is treated as absolute.
   */
  private absolute(location: string): boolean {
    return location.startsWith("/") || /^[A-Za-z]:\//u.test(location);
  }

  /**
   * Canonicalizes a location for case-insensitive Windows-style resolution.
   *
   * UNC prefixes are restored after POSIX normalization so distinct network
   * locations are not accidentally converted into ordinary rooted paths.
   */
  private locationKey(location: string): string {
    const slash = location.replaceAll("\\", "/");
    const unc = slash.startsWith("//");
    const normalized = path.posix.normalize(slash);
    const restored = unc ? `/${normalized}` : normalized;
    return unc || /^[A-Za-z]:\//u.test(restored)
      ? restored.toLowerCase()
      : restored;
  }

  /**
   * Produces TypeScript source candidates for a normalized import base.
   *
   * JavaScript-shaped extensions map to their TypeScript declaration forms,
   * while extensionless imports also consider supported index files.
   */
  private candidates(base: string): string[] {
    if (this.type === "javascript") return this.javaScriptCandidates(base);
    const extension = path.posix.extname(base).toLowerCase();
    const without = extension === "" ? base : base.slice(0, -extension.length);
    const files =
      extension === ".js" || extension === ".jsx"
        ? [without + ".ts", without + ".tsx", without + ".d.ts"]
        : extension === ".mjs"
          ? [without + ".mts", without + ".d.mts"]
          : extension === ".cjs"
            ? [without + ".cts", without + ".d.cts"]
            : extension === ""
              ? [
                  base + ".ts",
                  base + ".tsx",
                  base + ".d.ts",
                  base + ".mts",
                  base + ".cts",
                  base + ".d.mts",
                  base + ".d.cts",
                  path.posix.join(base, "index.ts"),
                  path.posix.join(base, "index.tsx"),
                  path.posix.join(base, "index.d.ts"),
                  path.posix.join(base, "index.mts"),
                  path.posix.join(base, "index.cts"),
                  path.posix.join(base, "index.d.mts"),
                  path.posix.join(base, "index.d.cts"),
                ]
              : [base];
    return Array.from(new Set(files.map((file) => this.locationKey(file))));
  }

  /**
   * Produces JavaScript source candidates for a normalized import base.
   *
   * Extensionless JavaScript imports may select ordinary or index modules, but
   * explicit extensions name exactly one selected source.
   */
  private javaScriptCandidates(base: string): string[] {
    const extension = path.posix.extname(base).toLowerCase();
    const files =
      extension === ""
        ? [
            base + ".js",
            base + ".jsx",
            base + ".mjs",
            base + ".cjs",
            path.posix.join(base, "index.js"),
            path.posix.join(base, "index.jsx"),
            path.posix.join(base, "index.mjs"),
            path.posix.join(base, "index.cjs"),
          ]
        : [base];
    return files.map((file) => this.locationKey(file));
  }

  /**
   * Records one export-resolution failure and marks the inventory incomplete.
   *
   * The key deduplicates repeated traversal failures while preserving a separate
   * diagnostic when another source or exported name has a distinct cause.
   */
  private problem(
    source: IEvidSourceFile,
    message: string,
    repair: string,
    key: string,
  ): void {
    if (this.reported.has(key)) return;
    this.reported.add(key);
    this.inventory.complete = false;
    this.inventory.diagnostics.push({
      code: `${this.type}-export`,
      severity: "error",
      message,
      repair,
      location: { file: source.physicalPath },
    });
  }
}
