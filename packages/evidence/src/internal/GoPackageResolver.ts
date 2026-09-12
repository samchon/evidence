import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidencePublicAddress } from "../structures/IEvidencePublicAddress";
import type { IEvidenceUnit } from "../structures/IEvidenceUnit";
import type { IGoDeclaration } from "./IGoDeclaration";
import type { IGoFileAnalysis } from "./IGoFileAnalysis";
import type { IGoMaterializedDeclaration } from "./IGoMaterializedDeclaration";

/** Joins Go files by directory and package before publishing receiver-owned units. */
export class GoPackageResolver {
  private readonly units = new Map<string, IEvidenceUnit>();
  private readonly identities = new Map<string, string>();
  private readonly addresses = new Set<string>();
  private readonly reported = new Set<string>();

  public constructor(
    private readonly analyses: IGoFileAnalysis[],
    private readonly inventory: IEvidenceInventory,
  ) {}

  public publish(): Map<string, string> {
    this.validatePackages();
    const entries = this.analyses.flatMap((analysis) =>
      analysis.packageName === undefined
        ? []
        : analysis.declarations.map((declaration) =>
            this.entry(analysis, declaration),
          ),
    );
    const types = new Map<string, IGoMaterializedDeclaration[]>();
    for (const entry of entries) {
      if (entry.declaration.symbol !== "type") continue;
      const key = this.ownerKey(entry.analysis, entry.declaration.name);
      const declarations = types.get(key) ?? [];
      declarations.push(entry);
      types.set(key, declarations);
    }

    const published = new Map<string, string>();
    for (const entry of entries) {
      const owner = entry.declaration.owner;
      const owners =
        owner === undefined
          ? []
          : (types.get(this.ownerKey(entry.analysis, owner)) ?? []);
      if (owner !== undefined) {
        const eligible =
          entry.declaration.form === "method"
            ? owners.filter(
                (candidate) => candidate.declaration.form === "defined-type",
              )
            : owners;
        if (eligible.length === 0) {
          const method = entry.declaration.form === "method";
          this.problem(
            method ? "go-receiver" : "go-owner",
            entry.analysis,
            method
              ? `Exported Go method '${owner}.${entry.declaration.name}' has no selected local defined receiver type.`
              : `Exported Go member '${owner}.${entry.declaration.name}' has no selected local owner type.`,
            method
              ? "Include the receiver's defined type in this package population or remove the method from the selected files."
              : "Include the owning type declaration in this package population.",
            JSON.stringify([entry.declaration.id, "owner"]),
          );
          continue;
        }
      }
      this.materialize(entry, owners);
      published.set(entry.declaration.id, entry.unitId);
    }
    this.inventory.units.push(...this.units.values());
    return published;
  }

  private materialize(
    entry: IGoMaterializedDeclaration,
    owners: IGoMaterializedDeclaration[],
  ): void {
    const declaration = entry.declaration;
    const identity =
      declaration.owner === undefined
        ? [declaration.name]
        : [declaration.owner, declaration.name];
    const identityKey = JSON.stringify([
      this.packageKey(entry.analysis),
      identity,
    ]);
    const previousIdentity = this.identities.get(identityKey);
    if (previousIdentity !== undefined && previousIdentity !== entry.unitId)
      this.problem(
        "go-identity-conflict",
        entry.analysis,
        `Go public identity '${identity.join(".")}' is declared with conflicting symbol kinds.`,
        "Rename one declaration or select a source set with one compatible public identity.",
        `${identityKey}:kind`,
      );
    else this.identities.set(identityKey, entry.unitId);

    let unit = this.units.get(entry.unitId);
    if (unit === undefined) {
      unit = {
        id: entry.unitId,
        type: "go",
        symbol: declaration.symbol,
        identity,
        name: declaration.name,
        sites: structuredClone(declaration.sites),
        withdrawals: [],
        ...(declaration.owner === undefined
          ? {}
          : {
              parentId: this.unitId(entry.analysis, "type", [
                declaration.owner,
              ]),
            }),
      };
      this.units.set(entry.unitId, unit);
    } else {
      this.problem(
        "go-declaration-conflict",
        entry.analysis,
        `Go public identity '${identity.join(".")}' has more than one selected declaration.`,
        "Narrow the configured source set or remove declarations duplicated across build-constrained files.",
        `${identityKey}:duplicate`,
      );
      for (const site of declaration.sites)
        if (!unit.sites.some((candidate) => candidate.id === site.id))
          unit.sites.push(structuredClone(site));
    }
    this.publishAddresses(entry, owners);
  }

  private publishAddresses(
    entry: IGoMaterializedDeclaration,
    owners: IGoMaterializedDeclaration[],
  ): void {
    const identity =
      entry.declaration.owner === undefined
        ? [entry.declaration.name]
        : [entry.declaration.owner, entry.declaration.name];
    const sources = [
      entry.analysis.source,
      ...owners.map((owner) => owner.analysis.source),
    ];
    for (const source of sources)
      for (const location of source.addresses) {
        const address: IEvidencePublicAddress = {
          unitId: entry.unitId,
          file: location.absolute,
          segments: identity,
        };
        const key = JSON.stringify(address);
        if (this.addresses.has(key)) continue;
        this.addresses.add(key);
        this.inventory.addresses.push(address);
      }
  }

  private validatePackages(): void {
    const directories = new Map<string, IGoFileAnalysis[]>();
    for (const analysis of this.analyses) {
      if (analysis.packageName === undefined) continue;
      const files = directories.get(analysis.directory) ?? [];
      files.push(analysis);
      directories.set(analysis.directory, files);
    }
    for (const [directory, files] of directories) {
      const ordinary = new Set(
        files.flatMap((file) =>
          !file.testFile && file.packageName !== undefined
            ? [file.packageName]
            : [],
        ),
      );
      if (ordinary.size > 1) {
        this.packageProblem(directory, files);
        continue;
      }
      const base =
        Array.from(ordinary)[0] ??
        this.testPackageBase(files.map((file) => file.packageName));
      if (
        base === undefined ||
        files.some(
          (file) =>
            file.packageName !== base &&
            !(file.testFile && file.packageName === `${base}_test`),
        )
      )
        this.packageProblem(directory, files);
    }
  }

  private testPackageBase(
    names: Array<string | undefined>,
  ): string | undefined {
    const packages = Array.from(
      new Set(names.filter((name) => name !== undefined)),
    );
    if (packages.length === 1) return packages[0];
    return packages.find((name) => packages.includes(`${name}_test`));
  }

  private packageProblem(directory: string, analyses: IGoFileAnalysis[]): void {
    const names = Array.from(
      new Set(analyses.map((analysis) => analysis.packageName)),
    )
      .filter((name) => name !== undefined)
      .sort((left, right) => left.localeCompare(right, "en"));
    this.problem(
      "go-package-boundary",
      analyses[0],
      `Selected Go directory '${directory}' contains incompatible packages: ${names.join(", ")}.`,
      "Select one ordinary package and, when needed, only its matching external _test package.",
      JSON.stringify([directory, names, "packages"]),
    );
  }

  private entry(
    analysis: IGoFileAnalysis,
    declaration: IGoDeclaration,
  ): IGoMaterializedDeclaration {
    const identity =
      declaration.owner === undefined
        ? [declaration.name]
        : [declaration.owner, declaration.name];
    return {
      analysis,
      declaration,
      unitId: this.unitId(analysis, declaration.symbol, identity),
    };
  }

  private unitId(
    analysis: IGoFileAnalysis,
    symbol: string,
    identity: string[],
  ): string {
    return `go:${this.packageKey(analysis)}:${symbol}:${JSON.stringify(identity)}`;
  }

  private ownerKey(analysis: IGoFileAnalysis, name: string): string {
    return JSON.stringify([this.packageKey(analysis), name]);
  }

  private packageKey(analysis: IGoFileAnalysis): string {
    return JSON.stringify([analysis.directory, analysis.packageName]);
  }

  private problem(
    code: string,
    analysis: IGoFileAnalysis | undefined,
    message: string,
    repair: string,
    key: string,
  ): void {
    if (this.reported.has(key)) return;
    this.reported.add(key);
    this.inventory.complete = false;
    this.inventory.diagnostics.push({
      code,
      severity: "error",
      message,
      repair,
      ...(analysis === undefined
        ? {}
        : { location: { file: analysis.source.physicalPath } }),
    });
  }
}
