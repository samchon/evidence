import type { IEvidenceAdapter } from "../../../../packages/evidence/src/structures/IEvidenceAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceSourceSnapshot } from "../../../../packages/evidence/src/structures/IEvidenceSourceSnapshot";
import type { EvidenceArtifactType } from "../../../../packages/evidence/src/typings/EvidenceArtifactType";
import type { AdapterCertificationMutationKind } from "./AdapterCertificationMutationKind";

/** Minimal adapter wrapper used to prove that certification detects extraction defects. */
export class TestCertificationAdapter implements IEvidenceAdapter {
  public readonly type: EvidenceArtifactType;

  public constructor(
    private readonly base: IEvidenceAdapter,
    private readonly mutation: AdapterCertificationMutationKind,
  ) {
    this.type = base.type;
  }

  public async analyze(
    snapshot: IEvidenceSourceSnapshot,
  ): Promise<IEvidenceInventory> {
    const inventory = await this.base.analyze(snapshot);
    if (this.mutation === "none") return inventory;
    if (this.mutation === "unit") {
      const index = inventory.units.findIndex(
        (unit) => unit.withdrawals.length === 0,
      );
      if (index === -1)
        throw new Error("The certification fixture has no public unit.");
      inventory.units.splice(index, 1);
      return inventory;
    }
    if (this.mutation === "kind") {
      const unit = inventory.units.find(
        (candidate) => candidate.symbol === "function",
      );
      if (unit === undefined)
        throw new Error("The certification fixture has no function unit.");
      unit.symbol = "property";
      return inventory;
    }
    if (this.mutation === "host") {
      const host = inventory.hosts.find(
        (candidate) => candidate.attachment === "attached",
      );
      if (host === undefined)
        throw new Error("The certification fixture has no attached host.");
      host.attachment = "unsupported";
      host.unitIds = [];
      delete host.siteId;
      return inventory;
    }

    const counts = new Map<string, number>();
    for (const address of inventory.addresses)
      counts.set(address.unitId, (counts.get(address.unitId) ?? 0) + 1);
    const alias = inventory.addresses.find(
      (address) => (counts.get(address.unitId) ?? 0) > 1,
    );
    const replacement = inventory.units.find(
      (unit) => unit.id !== alias?.unitId,
    );
    if (alias === undefined || replacement === undefined)
      throw new Error("The certification fixture has no semantic alias.");
    alias.unitId = replacement.id;
    return inventory;
  }
}
