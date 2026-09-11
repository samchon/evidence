import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidenceSourceLocation } from "../structures/IEvidenceSourceLocation";

/** Reconciles physical spellings across snapshots without rewriting public module addresses. */
export namespace InventorySources {
  export function reconcile(inputs: IEvidenceInventory[]): void {
    const canonical = new Map<string, string>();
    const owners = new Map<string, string>();
    for (const input of inputs)
      for (const source of input.sources) {
        const previous = canonical.get(source.id);
        if (previous === undefined || source.physicalPath < previous)
          canonical.set(source.id, source.physicalPath);
        const owner = owners.get(source.physicalPath);
        if (owner !== undefined && owner !== source.id) {
          input.complete = false;
          input.diagnostics.push({
            code: "inventory-source",
            severity: "error",
            message:
              "One physical source path has conflicting filesystem identities.",
            repair:
              "Load populations from a consistent filesystem snapshot before combining them.",
            location: { file: source.physicalPath },
          });
        }
        owners.set(source.physicalPath, source.id);
      }
    const paths = new Map<string, string>();
    for (const input of inputs)
      for (const source of input.sources)
        paths.set(
          source.physicalPath,
          canonical.get(source.id) ?? source.physicalPath,
        );

    function locate(location: IEvidenceSourceLocation): void {
      location.file = paths.get(location.file) ?? location.file;
    }

    for (const input of inputs) {
      for (const source of input.sources)
        source.physicalPath = canonical.get(source.id) ?? source.physicalPath;
      for (const unit of input.units) {
        for (const site of unit.sites) locate(site);
        for (const withdrawal of unit.withdrawals) locate(withdrawal.location);
      }
      for (const host of input.hosts) {
        host.origins = host.origins ?? [host.file];
        locate(host);
      }
      for (const declaration of input.declarations)
        locate(declaration.location);
      for (const review of input.reviews) locate(review.location);
      for (const diagnostic of input.diagnostics)
        if (diagnostic.location !== undefined) locate(diagnostic.location);
    }
  }
}
