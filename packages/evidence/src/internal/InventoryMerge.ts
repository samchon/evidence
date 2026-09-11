import typia from "typia";

import type { IEvidenceHost } from "../structures/IEvidenceHost";
import type { IEvidenceInventory } from "../structures/IEvidenceInventory";
import type { IEvidenceSourceAddress } from "../structures/IEvidenceSourceAddress";
import type { IEvidenceSourceFile } from "../structures/IEvidenceSourceFile";
import type { IEvidenceUnit } from "../structures/IEvidenceUnit";
import type { IEvidenceUnitSite } from "../structures/IEvidenceUnitSite";
import { InventorySources } from "./InventorySources";

/** Combines adapter-established identities while retaining conflicting analysis as a failure. */
export namespace InventoryMerge {
  export function combine(inputs: IEvidenceInventory[]): IEvidenceInventory {
    InventorySources.reconcile(inputs);
    const output: IEvidenceInventory = {
      schemaVersion: 1,
      sources: [],
      units: [],
      addresses: [],
      hosts: [],
      declarations: [],
      reviews: [],
      diagnostics: [],
      dependencies: [],
      complete: inputs.every((input) => input.complete),
    };
    const sources = new Map<string, IEvidenceSourceFile>();
    const units = new Map<string, IEvidenceUnit>();
    const hosts = new Map<string, IEvidenceHost>();
    for (const input of inputs) {
      output.diagnostics.push(...input.diagnostics);
      for (const source of input.sources) {
        const previous = sources.get(source.id);
        if (previous === undefined) sources.set(source.id, source);
        else if (
          previous.digest !== source.digest ||
          previous.content !== source.content
        )
          conflict(output, "source", source.id);
        else previous.addresses.push(...source.addresses);
      }
      for (const unit of input.units) {
        const previous = units.get(unit.id);
        if (previous === undefined) units.set(unit.id, unit);
        else if (unitKey(previous) !== unitKey(unit))
          conflict(output, "unit", unit.id);
        else {
          for (const site of unit.sites) {
            const existing = previous.sites.find(
              (candidate) => candidate.id === site.id,
            );
            if (existing === undefined) previous.sites.push(site);
            else if (
              siteKey(existing) !== siteKey(site) ||
              contentKey(existing) !== contentKey(site)
            )
              conflict(output, "declaration site", site.id);
          }
          previous.withdrawals.push(...unit.withdrawals);
        }
      }
      for (const host of input.hosts) {
        const previous = hosts.get(host.id);
        if (previous === undefined) hosts.set(host.id, host);
        else if (hostKey(previous) !== hostKey(host))
          conflict(output, "host", host.id);
        else {
          previous.unitIds.push(...host.unitIds);
          previous.origins = [
            ...(previous.origins ?? [previous.file]),
            ...(host.origins ?? [host.file]),
          ];
        }
      }
      output.addresses.push(...input.addresses);
      output.declarations.push(...input.declarations);
      output.reviews.push(...input.reviews);
      output.dependencies.push(...input.dependencies);
    }
    output.sources = Array.from(sources.values());
    output.units = Array.from(units.values());
    output.hosts = Array.from(hosts.values());

    // Duplicate physical tags can appear through aliases; conflicting bodies cannot be chosen by scan order.
    const declarations = new Map<string, string>();
    for (const declaration of output.declarations) {
      const previous = declarations.get(declaration.id);
      const body = typia.json.stringify(declaration);
      if (previous !== undefined && previous !== body)
        conflict(output, "acknowledgement", declaration.id);
      declarations.set(declaration.id, body);
    }
    const reviews = new Map<string, string>();
    for (const review of output.reviews) {
      const previous = reviews.get(review.id);
      const body = typia.json.stringify(review);
      if (previous !== undefined && previous !== body)
        conflict(output, "review", review.id);
      reviews.set(review.id, body);
    }
    if (
      !output.complete &&
      !output.diagnostics.some(
        (diagnostic) => diagnostic.code === "inventory-incomplete",
      )
    )
      output.diagnostics.push({
        code: "inventory-incomplete",
        severity: "error",
        message: "At least one adapter or source snapshot is incomplete.",
        repair:
          "Resolve the underlying analysis failure before evaluating evidence coverage.",
      });
    return output;
  }

  export function unique<T>(values: T[], key: (value: T) => string): T[] {
    const records = new Map<string, T>();
    for (const value of values) records.set(key(value), value);
    return Array.from(records)
      .sort(([x], [y]) => compare(x, y))
      .map(([, value]) => value);
  }

  export function compare(x: string, y: string): number {
    return x < y ? -1 : x > y ? 1 : 0;
  }

  /** A direct selection wins when another population loaded the same address as a dependency. */
  export function sourceAddresses(
    values: IEvidenceSourceAddress[],
  ): IEvidenceSourceAddress[] {
    const records = new Map<string, IEvidenceSourceAddress>();
    for (const value of values) {
      const key = JSON.stringify([
        value.absolute,
        value.relative,
        value.display,
      ]);
      const previous = records.get(key);
      if (previous === undefined) records.set(key, value);
      else if (previous.selected === false && value.selected !== false)
        delete previous.selected;
    }
    return Array.from(records)
      .sort(([x], [y]) => compare(x, y))
      .map(([, value]) => value);
  }

  export function siteKey(site: IEvidenceUnitSite): string {
    return JSON.stringify([
      site.id,
      site.file,
      typia.json.stringify(site.range),
    ]);
  }

  export function contentKey(site: IEvidenceUnitSite): string {
    return JSON.stringify(
      unique(
        site.content.map((range) => typia.json.stringify(range)),
        (value) => value,
      ),
    );
  }

  function unitKey(unit: IEvidenceUnit): string {
    return JSON.stringify([
      unit.type,
      unit.symbol,
      unit.parentId,
      unit.identity,
      unit.name,
    ]);
  }

  function hostKey(host: IEvidenceHost): string {
    return JSON.stringify([
      host.file,
      typia.json.stringify(host.range),
      host.siteId,
      host.attachment,
      host.problem,
    ]);
  }

  function conflict(
    output: IEvidenceInventory,
    kind: string,
    id: string,
  ): void {
    output.complete = false;
    output.diagnostics.push({
      code: "inventory-conflict",
      severity: "error",
      message: `Conflicting ${kind} records share identity ${id}.`,
      repair:
        "Correct the adapter identity or use a consistent source snapshot before combining inventories.",
    });
  }
}
