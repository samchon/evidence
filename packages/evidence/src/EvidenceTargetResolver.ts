import { stat } from "node:fs/promises";

import { EvidenceAccessor } from "./EvidenceAccessor";
import { EvidenceFileTarget } from "./EvidenceFileTarget";
import { EvidenceInventory } from "./EvidenceInventory";
import { InventoryMerge } from "./internal/InventoryMerge";
import { MarkdownTarget } from "./internal/MarkdownTarget";
import type { IEvidenceTargetCandidate } from "./internal/IEvidenceTargetCandidate";
import type { IEvidenceAddress } from "./structures/IEvidenceAddress";
import type { IEvidenceDiagnostic } from "./structures/IEvidenceDiagnostic";
import type { IEvidenceHost } from "./structures/IEvidenceHost";
import type { IEvidenceInventory } from "./structures/IEvidenceInventory";
import type { IEvidenceTargetResolution } from "./structures/IEvidenceTargetResolution";
import type { IEvidenceTargetStatement } from "./structures/IEvidenceTargetStatement";
import type { IEvidenceUnit } from "./structures/IEvidenceUnit";
import type { IEvidenceWithdrawal } from "./structures/IEvidenceWithdrawal";
import type { EvidenceTargetResolutionStatus } from "./typings/EvidenceTargetResolutionStatus";

/** Resolves file-qualified citations against one selected reference population. */
export class EvidenceTargetResolver {
  private readonly index: EvidenceInventory;
  private readonly inventory: IEvidenceInventory;
  private readonly selectedFiles = new Set<string>();
  private readonly physicalFiles = new Set<string>();
  private readonly publicFiles = new Map<string, Set<string>>();
  private readonly markdownFiles = new Map<string, Set<string>>();

  public constructor(inventories: IEvidenceInventory[]) {
    this.index = new EvidenceInventory(inventories);
    this.inventory = this.index.snapshot();
    for (const source of this.inventory.sources) {
      this.physicalFiles.add(EvidenceFileTarget.normalize(source.physicalPath));
      for (const address of source.addresses)
        if (address.selected !== false)
          this.selectedFiles.add(
            EvidenceFileTarget.normalize(address.absolute),
          );
    }
    for (const address of this.inventory.addresses) {
      const file = EvidenceFileTarget.normalize(address.file);
      let spellings = this.publicFiles.get(file);
      if (spellings === undefined) {
        spellings = new Set<string>();
        this.publicFiles.set(file, spellings);
      }
      spellings.add(address.file);
    }
    const markdownSources = new Set(
      this.inventory.units
        .filter((unit) => unit.type === "markdown")
        .flatMap((unit) =>
          unit.sites.map((site) => EvidenceFileTarget.normalize(site.file)),
        ),
    );
    for (const source of this.inventory.sources) {
      if (
        !markdownSources.has(EvidenceFileTarget.normalize(source.physicalPath))
      )
        continue;
      for (const address of source.addresses) {
        if (address.selected === false) continue;
        const relative = MarkdownTarget.normalize(address.relative);
        let files = this.markdownFiles.get(relative);
        if (files === undefined) {
          files = new Set<string>();
          this.markdownFiles.set(relative, files);
        }
        files.add(address.absolute);
      }
    }
  }

  /** Resolves all logical origins of one host without searching unrelated files by name. */
  public async resolve(
    statement: IEvidenceTargetStatement,
    host: IEvidenceHost,
    ids: string[],
  ): Promise<IEvidenceTargetResolution> {
    if (statement.hostId !== host.id)
      throw new Error(
        "The target statement does not belong to the supplied host.",
      );
    if (host.attachment !== "attached")
      return this.failure(
        "unsupported-host",
        [],
        [],
        [],
        this.diagnostic(
          statement,
          "target-unsupported-host",
          "The file-qualified target belongs to an unsupported documentation host.",
          host.problem ??
            "Attach the annotation to documentation owned by a supported declaration.",
        ),
      );

    const addresses: IEvidenceAddress[] = [];
    try {
      if (this.markdownReference(ids)) {
        const target = MarkdownTarget.parse(statement.target);
        for (const file of this.markdownFiles.get(target.file) ?? [])
          addresses.push({ file, segments: target.segments });
        if (addresses.length === 0) {
          if (!this.inventory.complete) return this.incomplete(statement, []);
          return this.failure(
            "missing-file",
            [],
            [],
            [],
            this.diagnostic(
              statement,
              "target-missing-file",
              `Markdown target file '${target.file}' is not among the selected reference files.`,
              "Correct the root-relative Markdown path or include that file in the reference.",
            ),
          );
        }
      } else {
        const origins = InventoryMerge.unique(
          host.origins ?? [host.file],
          (origin) => EvidenceFileTarget.normalize(origin),
        );
        for (const origin of origins)
          addresses.push(EvidenceFileTarget.parse(statement.target, origin));
      }
    } catch (cause) {
      return this.failure(
        "malformed",
        [],
        [],
        [],
        this.diagnostic(
          statement,
          "target-malformed",
          `The file-qualified target '${statement.target}' is malformed.`,
          cause instanceof Error
            ? cause.message
            : "Use a valid file-qualified public accessor.",
        ),
      );
    }
    const uniqueAddresses = InventoryMerge.unique(addresses, (address) =>
      JSON.stringify([address.file, address.segments]),
    );
    if (!this.inventory.complete)
      return this.incomplete(statement, uniqueAddresses);
    const candidates: IEvidenceTargetCandidate[] = [];
    for (const address of uniqueAddresses) {
      const file = EvidenceFileTarget.normalize(address.file);
      if (!this.selectedFiles.has(file)) continue;
      const spellings = this.publicFiles.get(file) ?? new Set([address.file]);
      for (const spelling of spellings)
        candidates.push({
          address: { file: spelling, segments: address.segments },
          resolution: this.index.resolve(
            { file: spelling, segments: address.segments },
            ids,
          ),
        });
    }
    if (candidates.length !== 0)
      return this.resolveCandidates(statement, uniqueAddresses, candidates);

    const existing = await Promise.all(
      uniqueAddresses.map((address) => this.exists(address.file)),
    );
    if (existing.includes("incomplete"))
      return this.failure(
        "incomplete",
        uniqueAddresses,
        [],
        [],
        this.diagnostic(
          statement,
          "target-file-access",
          "The target file could not be inspected while resolving the citation.",
          "Restore access to the target path and retry the Evidence check.",
        ),
      );
    const known = uniqueAddresses.some((address, index) => {
      const file = EvidenceFileTarget.normalize(address.file);
      return this.physicalFiles.has(file) || existing[index] === "file";
    });
    return this.failure(
      known ? "out-of-population" : "missing-file",
      uniqueAddresses,
      [],
      [],
      this.diagnostic(
        statement,
        known ? "target-out-of-population" : "target-missing-file",
        known
          ? `Target file '${this.files(uniqueAddresses)}' is outside the selected reference files.`
          : `Target file '${this.files(uniqueAddresses)}' is not an existing regular file.`,
        known
          ? "Add the file to this reference's files or cite a selected public address."
          : "Correct the path relative to the citing file or restore the missing file.",
      ),
    );
  }

  private resolveCandidates(
    statement: IEvidenceTargetStatement,
    addresses: IEvidenceAddress[],
    candidates: IEvidenceTargetCandidate[],
  ): IEvidenceTargetResolution {
    const units = this.uniqueUnits(
      candidates.flatMap((candidate) => candidate.resolution.units),
    );
    const withdrawals = this.uniqueWithdrawals(
      candidates.flatMap((candidate) => candidate.resolution.withdrawals),
    );
    if (
      units.length > 1 ||
      candidates.some(
        (candidate) => candidate.resolution.status === "ambiguous",
      )
    )
      return this.failure(
        "ambiguous",
        addresses,
        units,
        withdrawals,
        this.diagnostic(
          statement,
          "target-ambiguous",
          `The file-qualified target '${statement.target}' names more than one semantic identity.`,
          "Select one symbol kind or cite an unambiguous public accessor.",
        ),
      );
    if (units.length === 1) {
      const hidden = candidates.some(
        (candidate) => candidate.resolution.status === "hidden",
      );
      if (hidden)
        return this.failure(
          "hidden",
          addresses,
          units,
          withdrawals,
          this.diagnostic(
            statement,
            "target-hidden",
            `The file-qualified target '${statement.target}' names a withdrawn declaration.`,
            "Cite a public selected declaration or remove the stale acknowledgement.",
          ),
        );
      return {
        status: "resolved",
        addresses,
        units,
        withdrawals: [],
        diagnostics: [],
      };
    }
    return this.failure(
      "missing-member",
      addresses,
      [],
      [],
      this.diagnostic(
        statement,
        "target-missing-member",
        `Selected target file '${this.files(addresses)}' has no public selected address '${this.accessor(addresses)}'.`,
        "Correct the accessor, export a supported public declaration, or include its symbol kind in this reference.",
      ),
    );
  }

  private failure(
    status: Exclude<EvidenceTargetResolutionStatus, "resolved">,
    addresses: IEvidenceAddress[],
    units: IEvidenceUnit[],
    withdrawals: IEvidenceWithdrawal[],
    diagnostic: IEvidenceDiagnostic,
  ): IEvidenceTargetResolution {
    return {
      status,
      addresses,
      units,
      withdrawals,
      diagnostics: [diagnostic],
    };
  }

  private incomplete(
    statement: IEvidenceTargetStatement,
    addresses: IEvidenceAddress[],
  ): IEvidenceTargetResolution {
    return {
      status: "incomplete",
      addresses,
      units: [],
      withdrawals: [],
      diagnostics: [
        ...this.inventory.diagnostics,
        this.diagnostic(
          statement,
          "target-incomplete",
          "The target cannot be trusted because its reference inventory is incomplete.",
          "Resolve the reference inventory diagnostics before evaluating this citation.",
        ),
      ],
    };
  }

  private diagnostic(
    statement: IEvidenceTargetStatement,
    code: string,
    message: string,
    repair: string,
  ): IEvidenceDiagnostic {
    return {
      code,
      severity: "error",
      message,
      repair,
      location: statement.location,
      hostId: statement.hostId,
      target: statement.target,
    };
  }

  private async exists(
    file: string,
  ): Promise<"file" | "other" | "missing" | "incomplete"> {
    try {
      return (await stat(file)).isFile() ? "file" : "other";
    } catch (cause) {
      const code = this.errorCode(cause);
      return code === "ENOENT" || code === "ENOTDIR" ? "missing" : "incomplete";
    }
  }

  private markdownReference(ids: string[]): boolean {
    const selected = new Set(ids);
    let found = false;
    for (const unit of this.inventory.units) {
      if (!selected.has(unit.id)) continue;
      if (unit.type !== "markdown") return false;
      found = true;
    }
    return found;
  }

  private errorCode(cause: unknown): string | undefined {
    if (!(cause instanceof Error) || !("code" in cause)) return undefined;
    const code: unknown = cause.code;
    return typeof code === "string" ? code : undefined;
  }

  private uniqueUnits(units: IEvidenceUnit[]): IEvidenceUnit[] {
    return InventoryMerge.unique(units, (unit) => unit.id);
  }

  private uniqueWithdrawals(
    withdrawals: IEvidenceWithdrawal[],
  ): IEvidenceWithdrawal[] {
    return InventoryMerge.unique(withdrawals, (withdrawal) =>
      JSON.stringify(withdrawal),
    );
  }

  private files(addresses: IEvidenceAddress[]): string {
    return addresses
      .map((address) => address.file)
      .sort(InventoryMerge.compare)
      .join("', '");
  }

  private accessor(addresses: IEvidenceAddress[]): string {
    const first = addresses[0];
    return first === undefined ? "" : EvidenceAccessor.format(first.segments);
  }
}
