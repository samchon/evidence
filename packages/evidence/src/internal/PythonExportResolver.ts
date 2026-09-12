import path from "node:path";

import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidencePublicAddress } from "../structures/IEvidencePublicAddress";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IEvidenceSourceRoot } from "../structures/IEvidenceSourceRoot";
import type { IPythonBinding } from "./IPythonBinding";
import type { IPythonFileAnalysis } from "./IPythonFileAnalysis";
import type { IPythonModule } from "./IPythonModule";
import type { IPythonResolution } from "./IPythonResolution";
import type { IPythonResolvedBinding } from "./IPythonResolvedBinding";
import type { PythonResolutionMode } from "./PythonResolutionMode";
import { SourcePath } from "./SourcePath";

/** Resolves Python module bindings and __all__ across one source snapshot. */
export class PythonExportResolver {
  private readonly modules = new Map<string, IPythonModule>();
  private readonly locations = new Map<string, Set<string>>();
  private readonly targets = new Map<string, string | undefined>();
  private readonly resolutions = new Map<string, IPythonResolution>();
  private readonly reported = new Set<string>();

  public constructor(
    analyses: IPythonFileAnalysis[],
    private readonly inventory: IEvidenceInventory,
    private readonly root: IEvidenceSourceRoot,
  ) {
    for (const analysis of analyses) {
      const names = new Set<string>();
      if (analysis.all.state !== "static")
        for (const binding of analysis.bindings)
          if (
            binding.localName !== undefined &&
            !binding.localName.startsWith("_")
          )
            names.add(binding.localName);
      for (const name of analysis.all.names) names.add(name);
      this.modules.set(analysis.source.id, {
        source: analysis.source,
        all: analysis.all,
        bindings: analysis.bindings,
        units: analysis.units,
        names,
      });
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
    for (const module of this.modules.values())
      for (const name of Array.from(module.names).sort((left, right) =>
        left.localeCompare(right, "en"),
      )) {
        const resolution = this.resolve(module.source.id, name, "public");
        let materialized = false;
        for (const binding of resolution.bindings)
          materialized =
            this.publishBinding(
              module.source,
              binding,
              [name],
              new Set<string>(),
              published,
            ) || materialized;
        if (resolution.bindings.length === 0 || !materialized) {
          const explicit = module.all.names.includes(name);
          this.problem(
            module.source,
            resolution.cyclic
              ? `Python export '${name}' resolves only through a declaration-free import cycle.`
              : resolution.bindings.length !== 0
                ? `Python export '${name}' resolves to no supported type, function, or property unit.`
                : explicit
                  ? `Python __all__ names '${name}', but no supported declaration or local import supplies it.`
                  : `Public Python binding '${name}' has no supported declaration inside the source snapshot.`,
            resolution.cyclic
              ? "Break the cycle with a supported declaration or remove the cyclic reexport."
              : resolution.bindings.length !== 0
                ? "Export a supported declaration from the namespace or remove this binding from the public surface."
                : explicit
                  ? "Correct __all__, add the declaration, or include the local imported module in this population."
                  : "Hide the import with a leading underscore, define __all__, or include its local source module.",
            JSON.stringify([module.source.id, name, "unresolved"]),
          );
        }
      }
    return published;
  }

  private expandStars(): void {
    let changed = true;
    while (changed) {
      changed = false;
      for (const module of this.modules.values()) {
        if (module.all.state === "static") continue;
        for (const binding of module.bindings) {
          if (binding.kind !== "star" || binding.specifier === undefined)
            continue;
          const target = this.target(module.source, binding.specifier);
          const dependency =
            target === undefined ? undefined : this.modules.get(target);
          if (dependency === undefined) continue;
          for (const name of dependency.names)
            if (!name.startsWith("_") && !module.names.has(name)) {
              module.names.add(name);
              changed = true;
            }
        }
      }
    }
  }

  private resolve(
    sourceId: string,
    name: string,
    mode: PythonResolutionMode,
  ): IPythonResolution {
    const key = JSON.stringify([sourceId, name, mode]);
    const cached = this.resolutions.get(key);
    if (cached !== undefined) return cached;
    const resolution = this.resolveFrom(
      sourceId,
      name,
      mode,
      new Set<string>(),
    );
    this.resolutions.set(key, resolution);
    return resolution;
  }

  private resolveFrom(
    sourceId: string,
    name: string,
    mode: PythonResolutionMode,
    visited: Set<string>,
  ): IPythonResolution {
    const key = JSON.stringify([sourceId, name, mode]);
    if (visited.has(key)) return { bindings: [], cyclic: true };
    const module = this.modules.get(sourceId);
    if (module === undefined) return { bindings: [], cyclic: false };
    if (mode === "public" && !module.names.has(name))
      return { bindings: [], cyclic: false };

    visited.add(key);
    let winner = module.bindings
      .filter((binding) => binding.localName === name)
      .sort((left, right) => right.order - left.order)[0];
    for (const binding of module.bindings) {
      if (
        binding.kind !== "star" ||
        binding.specifier === undefined ||
        (winner !== undefined && winner.order > binding.order)
      )
        continue;
      const target = this.target(module.source, binding.specifier);
      const dependency =
        target === undefined ? undefined : this.modules.get(target);
      if (dependency !== undefined && dependency.names.has(name))
        winner = binding;
    }
    const output =
      winner === undefined
        ? { bindings: [], cyclic: false }
        : this.resolveBinding(module, winner, name, visited);
    visited.delete(key);
    return output;
  }

  private resolveBinding(
    module: IPythonModule,
    binding: IPythonBinding,
    name: string,
    visited: Set<string>,
  ): IPythonResolution {
    if (binding.kind === "local")
      return binding.root === undefined
        ? { bindings: [], cyclic: false }
        : {
            bindings: [{ sourceId: module.source.id, root: binding.root }],
            cyclic: false,
          };
    if (binding.specifier === undefined) return { bindings: [], cyclic: false };
    const target = this.target(module.source, binding.specifier);
    if (target === undefined) return { bindings: [], cyclic: false };
    if (binding.kind === "namespace")
      return { bindings: [{ sourceId: target }], cyclic: false };
    const importedName = binding.kind === "named" ? binding.importedName : name;
    if (importedName === undefined) return { bindings: [], cyclic: false };
    return this.resolveFrom(
      target,
      importedName,
      binding.kind === "star" ? "public" : "declared",
      visited,
    );
  }

  private publishBinding(
    entry: IEvidenceSourceFile,
    binding: IPythonResolvedBinding,
    prefix: string[],
    visited: Set<string>,
    published: Set<string>,
  ): boolean {
    const module = this.modules.get(binding.sourceId);
    if (module === undefined) return false;
    if (binding.root === undefined) {
      if (visited.has(binding.sourceId)) return false;
      const nested = new Set(visited);
      nested.add(binding.sourceId);
      let materialized = false;
      for (const name of Array.from(module.names).sort((left, right) =>
        left.localeCompare(right, "en"),
      ))
        for (const child of this.resolve(binding.sourceId, name, "public")
          .bindings)
          materialized =
            this.publishBinding(
              entry,
              child,
              [...prefix, name],
              nested,
              published,
            ) || materialized;
      return materialized;
    }
    let materialized = false;
    for (const owned of module.units) {
      if (!owned.roots.includes(binding.root)) continue;
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
      materialized = true;
    }
    return materialized;
  }

  private target(
    source: IEvidenceSourceFile,
    specifier: string,
  ): string | undefined {
    const key = JSON.stringify([source.id, specifier]);
    if (this.targets.has(key)) return this.targets.get(key);
    const found = new Set<string>();
    let outside = false;
    for (const location of this.sourceLocations(source)) {
      const base = this.importBase(source, location, specifier);
      if (base === undefined) continue;
      for (const candidate of this.candidates(base)) {
        if (
          !SourcePath.contains(this.locationKey(this.root.absolute), candidate)
        ) {
          outside = true;
          continue;
        }
        for (const id of this.locations.get(candidate) ?? []) {
          const dependency = this.modules.get(id)?.source;
          if (dependency !== undefined && !this.insidePhysicalRoot(dependency))
            outside = true;
          else found.add(id);
        }
      }
    }
    const target = found.size === 1 ? Array.from(found)[0] : undefined;
    if (target === undefined)
      this.problem(
        source,
        outside && found.size === 0
          ? `Python import '${specifier}' leaves the declared source root.`
          : found.size === 0
            ? `Python import '${specifier}' is absent from the complete source snapshot.`
            : `Python import '${specifier}' resolves to more than one physical source.`,
        outside && found.size === 0
          ? "Move the dependency inside the configured root or use a population rooted at its package tree."
          : found.size === 0
            ? "Include the local .py/.pyi dependency or hide the binding from the public module surface."
            : "Remove ambiguous aliases or retain one unambiguous module source.",
        key,
      );
    this.targets.set(key, target);
    return target;
  }

  private importBase(
    source: IEvidenceSourceFile,
    location: string,
    specifier: string,
  ): string | undefined {
    const normalized = specifier.replaceAll("\\", "/");
    if (normalized.startsWith(".")) {
      const prefix = /^\.+/u.exec(normalized)?.[0] ?? "";
      let base = path.posix.dirname(location);
      for (let level = 1; level < prefix.length; ++level)
        base = path.posix.dirname(base);
      const remainder = normalized.slice(prefix.length).replaceAll(".", "/");
      return this.locationKey(
        remainder === "" ? base : path.posix.join(base, remainder),
      );
    }
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/u.test(normalized)) {
      this.problem(
        source,
        `Python import '${specifier}' has an unsupported static module spelling.`,
        "Use a dotted absolute module name or a leading-dot relative module name.",
        JSON.stringify([location, specifier, "spelling"]),
      );
      return undefined;
    }
    return this.locationKey(
      path.posix.join(
        this.locationKey(this.root.absolute),
        normalized.replaceAll(".", "/"),
      ),
    );
  }

  private candidates(base: string): string[] {
    return [
      `${base}.py`,
      `${base}.pyi`,
      path.posix.join(base, "__init__.py"),
      path.posix.join(base, "__init__.pyi"),
    ].map((candidate) => this.locationKey(candidate));
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
        ...source.addresses.map((address) =>
          this.locationKey(address.absolute),
        ),
      ]),
    );
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

  private problem(
    source: IEvidenceSourceFile | undefined,
    message: string,
    repair: string,
    key: string,
  ): void {
    if (this.reported.has(key)) return;
    this.reported.add(key);
    this.inventory.complete = false;
    this.inventory.diagnostics.push({
      code: "python-export",
      severity: "error",
      message,
      repair,
      ...(source === undefined
        ? {}
        : { location: { file: source.physicalPath } }),
    });
  }
}
