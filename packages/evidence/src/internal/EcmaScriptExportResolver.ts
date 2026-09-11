import path from "node:path";

import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidencePublicAddress } from "../structures/IEvidencePublicAddress";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IEvidenceSourceRoot } from "../structures/IEvidenceSourceRoot";
import type { IEcmaScriptBinding } from "./IEcmaScriptBinding";
import type { IEcmaScriptFileAnalysis } from "./IEcmaScriptFileAnalysis";
import type { IEcmaScriptModule } from "./IEcmaScriptModule";
import type { IEcmaScriptResolution } from "./IEcmaScriptResolution";
import type { EcmaScriptType } from "./EcmaScriptType";
import { SourcePath } from "./SourcePath";

/** Resolves static exports across one ECMAScript-family source snapshot. */
export class EcmaScriptExportResolver {
  private readonly modules = new Map<string, IEcmaScriptModule>();
  private readonly locations = new Map<string, Set<string>>();
  private readonly targets = new Map<string, string | undefined>();
  private readonly resolutions = new Map<string, IEcmaScriptResolution>();
  private readonly reported = new Set<string>();

  public constructor(
    analyses: IEcmaScriptFileAnalysis[],
    private readonly inventory: IEvidenceInventory,
    private readonly root: IEvidenceSourceRoot,
    private readonly type: EcmaScriptType,
  ) {
    for (const analysis of analyses) {
      const module: IEcmaScriptModule = {
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
    this.expandStars();
  }

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

  private resolve(sourceId: string, name: string): IEcmaScriptResolution {
    const key = JSON.stringify([sourceId, name]);
    const cached = this.resolutions.get(key);
    if (cached !== undefined) return cached;
    const resolved = this.resolveFrom(sourceId, name, new Set<string>());
    this.resolutions.set(key, resolved);
    return resolved;
  }

  private resolveFrom(
    sourceId: string,
    name: string,
    visited: Set<string>,
  ): IEcmaScriptResolution {
    const key = JSON.stringify([sourceId, name]);
    if (visited.has(key))
      return { bindings: [], excluded: false, cyclic: true };
    const module = this.modules.get(sourceId);
    if (module === undefined)
      return { bindings: [], excluded: false, cyclic: false };
    visited.add(key);
    const output: IEcmaScriptResolution = {
      bindings: [],
      excluded: false,
      cyclic: false,
    };
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

  private publishBinding(
    entry: IEvidenceSourceFile,
    binding: IEcmaScriptBinding,
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
      const address: IEvidencePublicAddress = {
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

  private addBinding(
    output: IEcmaScriptBinding[],
    binding: IEcmaScriptBinding,
  ): void {
    const previous = output.find(
      (entry) =>
        entry.sourceId === binding.sourceId &&
        entry.localName === binding.localName,
    );
    if (previous === undefined) output.push(binding);
    else previous.typeOnly = previous.typeOnly && binding.typeOnly;
  }

  private mergeState(
    output: IEcmaScriptResolution,
    resolved: IEcmaScriptResolution,
  ): void {
    output.excluded ||= resolved.excluded;
    output.cyclic ||= resolved.cyclic;
  }

  private exported(sourceId: string, name: string): boolean {
    const module = this.modules.get(sourceId);
    return module !== undefined && module.names.has(name);
  }

  private target(
    source: IEvidenceSourceFile,
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
            !SourcePath.contains(
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

  private insidePhysicalRoot(source: IEvidenceSourceFile): boolean {
    return (
      this.root.physical === undefined ||
      SourcePath.contains(this.root.physical, source.physicalPath)
    );
  }

  private sourceLocations(source: IEvidenceSourceFile): string[] {
    return Array.from(
      new Set([
        this.locationKey(source.physicalPath),
        ...source.addresses.map((entry) => this.locationKey(entry.absolute)),
      ]),
    );
  }

  private absolute(location: string): boolean {
    return location.startsWith("/") || /^[A-Za-z]:\//u.test(location);
  }

  private locationKey(location: string): string {
    const slash = location.replaceAll("\\", "/");
    const unc = slash.startsWith("//");
    const normalized = path.posix.normalize(slash);
    const restored = unc ? `/${normalized}` : normalized;
    return unc || /^[A-Za-z]:\//u.test(restored)
      ? restored.toLowerCase()
      : restored;
  }

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

  private problem(
    source: IEvidenceSourceFile,
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
