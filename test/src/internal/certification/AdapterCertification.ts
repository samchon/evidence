import { TestValidator } from "@nestia/e2e";

import { EvidenceAccessor } from "../../../../packages/evidence/src/targets/EvidenceAccessor";
import { EvidenceFingerprint } from "../../../../packages/evidence/src/graph/EvidenceFingerprint";
import { EvidenceGraph } from "../../../../packages/evidence/src/graph/EvidenceGraph";
import { EvidenceInventory } from "../../../../packages/evidence/src/graph/EvidenceInventory";
import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/adapters/markdown/EvidenceMarkdownAdapter";
import type { IEvidenceAddress } from "../../../../packages/evidence/src/structures/IEvidenceAddress";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceSourceSnapshot } from "../../../../packages/evidence/src/structures/IEvidenceSourceSnapshot";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import type { EvidenceProgrammingSymbol } from "../../../../packages/evidence/src/typings/EvidenceProgrammingSymbol";
import { TestGraph } from "../TestGraph";
import { TestSourceSnapshot } from "../TestSourceSnapshot";
import type { IAdapterCertification } from "./IAdapterCertification";
import type { IAdapterCertificationAddress } from "./IAdapterCertificationAddress";
import type { IAdapterCertificationHost } from "./IAdapterCertificationHost";
import type { IAdapterCertificationSource } from "./IAdapterCertificationSource";
import type { IAdapterCertificationUnit } from "./IAdapterCertificationUnit";

/** Runs the same inventory, graph, failure, and mutation contract for every adapter. */
export namespace AdapterCertification {
  export async function analyze(
    certification: IAdapterCertification,
    sources: IAdapterCertificationSource[] = certification.sources,
  ): Promise<IEvidenceInventory> {
    return certification.adapter.analyze(snapshot(sources));
  }

  export function assertInventory(
    certification: IAdapterCertification,
    inventory: IEvidenceInventory,
  ): void {
    TestValidator.equals(
      `${certification.type} certification adapter type`,
      certification.adapter.type,
      certification.type,
    );
    TestValidator.equals(
      `${certification.type} certification unit types`,
      Array.from(new Set(inventory.units.map((unit) => unit.type))),
      [certification.type],
    );
    const keys = new Map(
      inventory.units.map((unit) => [unit.id, unitKey(unit)]),
    );
    const files = new Map(
      inventory.sources.flatMap((source) =>
        source.addresses.map((address) => [address.absolute, address.relative]),
      ),
    );
    const units = inventory.units
      .map((unit) => normalizeUnit(inventory, unit, keys, files))
      .sort(compareKey);
    const hosts = inventory.hosts
      .map((host) => ({
        attachment: host.attachment,
        units: host.unitIds.map((id) => requireKey(keys, id)).sort(compare),
      }))
      .sort(compareValue);
    const requirements = inventory.declarations
      .map((declaration) => {
        const host = inventory.hosts.find(
          (candidate) => candidate.id === declaration.hostId,
        );
        if (host === undefined || host.unitIds.length !== 1)
          throw new Error(
            `${certification.type} certification declarations require one semantic host.`,
          );
        const id = host.unitIds[0];
        if (id === undefined)
          throw new Error(`${certification.type} declaration host is empty.`);
        return {
          unit: requireKey(keys, id),
          target: declaration.target,
        };
      })
      .sort(compareValue);

    TestValidator.equals(
      `${certification.type} exact certification units`,
      units,
      certification.units.map(normalizeExpectedUnit).sort(compareKey),
    );
    TestValidator.equals(
      `${certification.type} exact certification hosts`,
      hosts,
      certification.hosts.map(normalizeHost).sort(compareValue),
    );
    TestValidator.equals(
      `${certification.type} exact certification declarations`,
      requirements,
      [...certification.requirements].sort(compareValue),
    );
    TestValidator.equals(
      `${certification.type} certification annotation ranges`,
      inventory.annotationRanges.length,
      certification.annotationRanges,
    );
    TestValidator.equals(
      `${certification.type} certification reviews`,
      inventory.reviews,
      [],
    );
    TestValidator.equals(
      `${certification.type} certification diagnostics`,
      inventory.diagnostics,
      [],
    );
    TestValidator.equals(
      `${certification.type} certification completeness`,
      inventory.complete,
      true,
    );
    for (const excluded of certification.excludedUnits)
      TestValidator.predicate(
        `${certification.type} excludes ${excluded}`,
        !Array.from(keys.values()).some((key) => key === excluded),
      );

    for (const requirement of certification.requirements) {
      const declaration = inventory.declarations.find(
        (candidate) => candidate.target === requirement.target,
      );
      if (declaration === undefined || declaration.location.range === undefined)
        throw new Error(
          `${certification.type} certification declaration has no source range.`,
        );
      const source = inventory.sources.find(
        (candidate) => candidate.physicalPath === declaration.location.file,
      );
      if (source === undefined)
        throw new Error(
          `${certification.type} certification source is absent.`,
        );
      TestValidator.equals(
        `${certification.type} Unicode annotation offset for ${requirement.target}`,
        declaration.location.range.start.offset,
        source.content.indexOf(`@evidence ${requirement.target}`),
      );
      TestValidator.predicate(
        `${certification.type} Unicode prefix for ${requirement.target}`,
        /[^\u0000-\u007f]/u.test(
          source.content.slice(0, declaration.location.range.start.offset),
        ),
      );
    }
  }

  export async function assertGraph(
    certification: IAdapterCertification,
  ): Promise<void> {
    const claim = await analyze(certification);
    const reference = await new EvidenceMarkdownAdapter().analyze(
      TestSourceSnapshot.create(
        "docs/requirements.md",
        certification.requirements
          .map((requirement) => {
            const anchor = requirement.target.split("#").at(-1) ?? "";
            return `## ${anchor} {#${anchor}}\n\nCertified requirement ${anchor}.\n`;
          })
          .join("\n"),
      ),
    );
    const claimUnits = certification.requirements.map((requirement) =>
      requireUnit(claim, requirement.unit),
    );
    const referenceUnits = certification.requirements.map((requirement) => {
      const anchor = requirement.target.split("#").at(-1) ?? "";
      const unit = reference.units.find(
        (candidate) => candidate.identity.at(-1) === anchor,
      );
      if (unit === undefined)
        throw new Error(`Missing certification requirement: ${anchor}`);
      return unit;
    });
    const selected = referenceUnits.map((unit) => unit.id);
    const resolutions = await TestGraph.resolveDeclarations(
      claim,
      reference,
      selected,
    );
    const complete = EvidenceGraph.evaluate({
      claims: [
        {
          severity: "error",
          inventory: claim,
          unitIds: claimUnits.map((unit) => unit.id),
          references: [
            {
              severity: "error",
              inventory: reference,
              unitIds: selected,
              resolutions,
            },
          ],
        },
      ],
    });
    TestValidator.equals(
      `${certification.type} complete certification graph`,
      complete.success,
      true,
    );

    for (let index = 0; index < certification.requirements.length; ++index) {
      const requirement = certification.requirements[index];
      const missingUnit = referenceUnits[index];
      if (requirement === undefined || missingUnit === undefined)
        throw new Error(`${certification.type} requirement pairing is absent.`);
      const missing = structuredClone(claim);
      missing.declarations = missing.declarations.filter(
        (declaration) => declaration.target !== requirement.target,
      );
      const partial = EvidenceGraph.evaluate({
        claims: [
          {
            severity: "error",
            inventory: missing,
            unitIds: claimUnits.map((unit) => unit.id),
            references: [
              {
                severity: "error",
                inventory: reference,
                unitIds: selected,
                resolutions: await TestGraph.resolveDeclarations(
                  missing,
                  reference,
                  selected,
                ),
              },
            ],
          },
        ],
      });
      TestValidator.equals(
        `${certification.type} missing ${requirement.unit} evidence`,
        TestGraph.obligation(partial, 0, 0).missingUnitIds,
        [missingUnit.id],
      );
    }
  }

  export async function assertFailures(
    certification: IAdapterCertification,
  ): Promise<void> {
    for (const failure of [certification.incomplete, certification.malformed]) {
      const inventory = await analyze(certification, failure.sources);
      TestValidator.equals(
        `${certification.type} incomplete certification fixture`,
        inventory.complete,
        false,
      );
      TestValidator.equals(
        `${certification.type} exact certification diagnostics`,
        inventory.diagnostics
          .map((diagnostic) => diagnostic.code)
          .sort(compare),
        ["inventory-incomplete", ...failure.diagnosticCodes].sort(compare),
      );
    }

    const falsePositive = await analyze(certification, [
      certification.falsePositive.source,
    ]);
    TestValidator.equals(
      `${certification.type} attached false-positive control`,
      falsePositive.declarations.map((declaration) => declaration.target),
      [certification.falsePositive.attachedTarget],
    );
    TestValidator.equals(
      `${certification.type} exact false-positive diagnostics`,
      falsePositive.diagnostics.map((diagnostic) => diagnostic.code),
      new Array<string>(
        certification.falsePositive.unsupportedAnnotations,
      ).fill("unsupported-annotation-host"),
    );
    TestValidator.equals(
      `${certification.type} false-positive completeness`,
      falsePositive.complete,
      true,
    );
  }

  export async function assertFingerprint(
    certification: IAdapterCertification,
  ): Promise<void> {
    const original = await analyze(certification);
    const reason = await analyze(
      certification,
      replace(
        certification.sources,
        certification.mutation.reasonBefore,
        certification.mutation.reasonAfter,
      ),
    );
    const content = await analyze(
      certification,
      replace(
        certification.sources,
        certification.mutation.contentBefore,
        certification.mutation.contentAfter,
      ),
    );
    const originalUnit = requireUnit(original, certification.mutation.unit);
    const reasonUnit = requireUnit(reason, certification.mutation.unit);
    const contentUnit = requireUnit(content, certification.mutation.unit);

    TestValidator.equals(
      `${certification.type} annotation-stable fingerprint`,
      EvidenceFingerprint.inspect(original, originalUnit.id).fingerprint,
      EvidenceFingerprint.inspect(reason, reasonUnit.id).fingerprint,
    );
    TestValidator.notEquals(
      `${certification.type} semantic mutation fingerprint`,
      EvidenceFingerprint.inspect(original, originalUnit.id).fingerprint,
      EvidenceFingerprint.inspect(content, contentUnit.id).fingerprint,
    );
  }

  export async function assertAmbiguity(
    certification: IAdapterCertification,
  ): Promise<void> {
    const inventory = await analyze(certification);
    const first = requireUnit(
      inventory,
      certification.requirements[0]?.unit ?? "",
    );
    const second = requireUnit(
      inventory,
      certification.requirements[1]?.unit ?? "",
    );
    const address = inventory.addresses.find(
      (candidate) => candidate.unitId === first.id,
    );
    if (address === undefined)
      throw new Error(`${certification.type} certification address is absent.`);
    const ambiguous = structuredClone(inventory);
    ambiguous.addresses.push({ ...address, unitId: second.id });
    const resolution = new EvidenceInventory([ambiguous]).resolve(
      pickAddress(address),
      certification.requirements.map(
        (requirement) => requireUnit(ambiguous, requirement.unit).id,
      ),
    );
    TestValidator.equals(
      `${certification.type} ambiguous certification target`,
      resolution.status,
      "ambiguous",
    );
  }

  function snapshot(
    sources: IAdapterCertificationSource[],
  ): IEvidenceSourceSnapshot {
    return TestSourceSnapshot.combine(
      sources.map((source) =>
        TestSourceSnapshot.create(source.file, source.content),
      ),
    );
  }

  function normalizeUnit(
    inventory: IEvidenceInventory,
    unit: IEvidenceUnit,
    keys: Map<string, string>,
    files: Map<string, string>,
  ): IAdapterCertificationUnit {
    return {
      key: unitKey(unit),
      symbol: programmingSymbol(unit.symbol),
      identity: unit.identity,
      ...(unit.parentId === undefined
        ? {}
        : { parent: requireKey(keys, unit.parentId) }),
      sites: unit.sites.length,
      addresses: inventory.addresses
        .filter((address) => address.unitId === unit.id)
        .map((address) => ({
          file: files.get(address.file) ?? address.file,
          accessor: EvidenceAccessor.format(address.segments),
        }))
        .sort(compareAddress),
      withdrawals: unit.withdrawals
        .map((withdrawal) => withdrawal.tag)
        .sort(compare),
    };
  }

  function normalizeExpectedUnit(
    unit: IAdapterCertificationUnit,
  ): IAdapterCertificationUnit {
    return {
      ...unit,
      addresses: [...unit.addresses].sort(compareAddress),
      withdrawals: [...unit.withdrawals].sort(compare),
    };
  }

  function normalizeHost(
    host: IAdapterCertificationHost,
  ): IAdapterCertificationHost {
    return { ...host, units: [...host.units].sort(compare) };
  }

  function requireUnit(
    inventory: IEvidenceInventory,
    key: string,
  ): IEvidenceUnit {
    const unit = inventory.units.find(
      (candidate) => unitKey(candidate) === key,
    );
    if (unit === undefined)
      throw new Error(`Missing certification unit: ${key}`);
    return unit;
  }

  function requireKey(keys: Map<string, string>, id: string): string {
    const key = keys.get(id);
    if (key === undefined)
      throw new Error(`Missing certification identity: ${id}`);
    return key;
  }

  function unitKey(unit: IEvidenceUnit): string {
    return `${unit.symbol}:${EvidenceAccessor.format(unit.identity)}`;
  }

  function replace(
    sources: IAdapterCertificationSource[],
    before: string,
    after: string,
  ): IAdapterCertificationSource[] {
    let replacements = 0;
    const output = sources.map((source) => {
      const content = source.content.replace(before, () => {
        ++replacements;
        return after;
      });
      return { ...source, content };
    });
    if (replacements !== 1)
      throw new Error(
        `Certification mutation expected one occurrence but replaced ${replacements}: ${before}`,
      );
    return output;
  }

  function pickAddress(address: IEvidenceAddress): IEvidenceAddress {
    return { file: address.file, segments: address.segments };
  }

  function compareKey(
    left: IAdapterCertificationUnit,
    right: IAdapterCertificationUnit,
  ): number {
    return compare(left.key, right.key);
  }

  function compareAddress(
    left: IAdapterCertificationAddress,
    right: IAdapterCertificationAddress,
  ): number {
    return compare(
      `${left.file}#${left.accessor}`,
      `${right.file}#${right.accessor}`,
    );
  }

  function compareValue(left: object, right: object): number {
    return compare(JSON.stringify(left), JSON.stringify(right));
  }

  function compare(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
  }

  function programmingSymbol(symbol: string): EvidenceProgrammingSymbol {
    if (symbol === "type" || symbol === "function" || symbol === "property")
      return symbol;
    throw new Error(`Certification found a non-programming symbol: ${symbol}`);
  }
}
