import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceGraph } from "../../../../packages/evidence/src/EvidenceGraph";
import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/EvidenceMarkdownAdapter";
import { EvidenceTargetResolver } from "../../../../packages/evidence/src/EvidenceTargetResolver";
import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/EvidenceTypeScriptAdapter";
import type { IEvidenceGraphResolution } from "../../../../packages/evidence/src/structures/IEvidenceGraphResolution";
import type { IEvidenceHost } from "../../../../packages/evidence/src/structures/IEvidenceHost";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Evaluates every selected TypeScript host against every selected Markdown item. */
export async function test_graph_checklist(): Promise<void> {
  const requirements = await new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create(
      "docs/rules.md",
      dedent`
        # Engineering rules

        ## No hardcoding {#no-hardcoding}

        Keep policy in data.

        ## No whack-a-mole {#no-whack-a-mole}

        Repair causes across the consequence surface.
      `,
    ),
  );
  const file = requireUnit(requirements, "file");
  const hardcoding = requireUnit(requirements, "no-hardcoding");
  const whackAMole = requireUnit(requirements, "no-whack-a-mole");

  // One complete host cannot discharge a partial or undocumented host's checklist.
  const claims = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/checks.ts",
      dedent`
        /**
         * @evidence ../docs/rules.md#["no-hardcoding"] Uses injected policy.
         * @evidence ../docs/rules.md#["no-whack-a-mole"] Repairs the shared cause.
         */
        export function thorough(): void {}

        /** @evidence ../docs/rules.md#["no-hardcoding"] Uses injected policy. */
        export function partial(): void {}

        export function empty(): void {}
      `,
    ),
  );
  const thorough = requireUnit(claims, "thorough");
  const partial = requireUnit(claims, "partial");
  const empty = requireUnit(claims, "empty");
  const checklistResolutions = await resolveAll(claims, requirements, [
    hardcoding.id,
    whackAMole.id,
  ]);
  TestValidator.equals(
    "checklist targets resolve",
    checklistResolutions.map((entry) => entry.resolution.status),
    ["resolved", "resolved", "resolved"],
  );
  const checklist = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claims,
        unitIds: [thorough.id, partial.id, empty.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [hardcoding.id, whackAMole.id],
            resolutions: checklistResolutions,
            checklist: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "complete host",
    TestGraph.hostCoverage(checklist, 0, 0, thorough.id).missingUnitIds,
    [],
  );
  TestValidator.equals(
    "partial host",
    TestGraph.hostCoverage(checklist, 0, 0, partial.id).missingUnitIds,
    [whackAMole.id],
  );
  TestValidator.equals(
    "undocumented host",
    TestGraph.hostCoverage(checklist, 0, 0, empty.id).missingUnitIds,
    [hardcoding.id, whackAMole.id],
  );
  TestValidator.equals(
    "one checklist finding per incomplete host",
    count(checklist, "graph-checklist-missing"),
    2,
  );

  // A selected file citation answers only the file item and does not cascade into headings.
  const fileClaim = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/file-check.ts",
      dedent`
        /** @evidence ../docs/rules.md Answers only the document item. */
        export function checksFile(): void {}
      `,
    ),
  );
  const checksFile = requireUnit(fileClaim, "checksFile");
  const fileChecklist = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: fileClaim,
        unitIds: [checksFile.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [file.id, hardcoding.id, whackAMole.id],
            resolutions: await resolveAll(fileClaim, requirements, [
              file.id,
              hardcoding.id,
              whackAMole.id,
            ]),
            checklist: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "file citation covers only itself",
    TestGraph.hostCoverage(fileChecklist, 0, 0, checksFile.id).coveredUnitIds,
    [file.id],
  );
  TestValidator.equals(
    "headings remain owed",
    TestGraph.hostCoverage(fileChecklist, 0, 0, checksFile.id).missingUnitIds,
    [hardcoding.id, whackAMole.id],
  );

  // An unselected positive aggregate is diagnosed once and suppresses duplicate host repair demands.
  const aggregate = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: fileClaim,
        unitIds: [checksFile.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [hardcoding.id, whackAMole.id],
            resolutions: await resolveAll(fileClaim, requirements, [
              hardcoding.id,
              whackAMole.id,
            ]),
            checklist: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "aggregate finding",
    count(aggregate, "graph-checklist-aggregate"),
    1,
  );
  TestValidator.equals(
    "aggregate suppresses derivative checklist finding",
    count(aggregate, "graph-checklist-missing"),
    0,
  );
  TestValidator.equals(
    "aggregate explains both missing items",
    TestGraph.hostCoverage(aggregate, 0, 0, checksFile.id).explainedUnitIds,
    [hardcoding.id, whackAMole.id],
  );

  // An exclusion keeps its subtree cascade on its own host without conflicting with another host's evidence.
  const exclusions = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/exclusions.ts",
      dedent`
        /** @evidenceExclude ../docs/rules.md No checklist rule applies here. */
        export function excluded(): void {}

        /** @evidence ../docs/rules.md#["no-hardcoding"] Uses injected policy. */
        export function localEvidence(): void {}
      `,
    ),
  );
  const excluded = requireUnit(exclusions, "excluded");
  const localEvidence = requireUnit(exclusions, "localEvidence");
  const excludedChecklist = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: exclusions,
        unitIds: [excluded.id, localEvidence.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [hardcoding.id, whackAMole.id],
            resolutions: await resolveAll(exclusions, requirements, [
              hardcoding.id,
              whackAMole.id,
            ]),
            checklist: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "exclusion cascades on its host",
    TestGraph.hostCoverage(excludedChecklist, 0, 0, excluded.id).coveredUnitIds,
    [hardcoding.id, whackAMole.id],
  );
  TestValidator.equals(
    "other host remains independent",
    TestGraph.hostCoverage(excludedChecklist, 0, 0, localEvidence.id)
      .missingUnitIds,
    [whackAMole.id],
  );
  TestValidator.equals(
    "opposite intent on different hosts is legal",
    count(excludedChecklist, "graph-conflicting-acknowledgements"),
    0,
  );

  // Conflicts and overlapping exclusions are keyed to one semantic checklist host.
  const localRules = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/local-rules.ts",
      dedent`
        /**
         * @evidence ../docs/rules.md#["no-hardcoding"] Applies here.
         * @evidenceExclude ../docs/rules.md#["no-hardcoding"] Does not apply here.
         */
        export function conflict(): void {}

        /**
         * @evidenceExclude ../docs/rules.md No rules apply here.
         * @evidenceExclude ../docs/rules.md#["no-hardcoding"] This rule also does not apply.
         */
        export function duplicate(): void {}
      `,
    ),
  );
  const localResult = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: localRules,
        unitIds: localRules.units.map((unit) => unit.id),
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [hardcoding.id, whackAMole.id],
            resolutions: await resolveAll(localRules, requirements, [
              hardcoding.id,
              whackAMole.id,
            ]),
            checklist: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "same-host opposite intent conflicts once",
    count(localResult, "graph-conflicting-acknowledgements"),
    1,
  );
  TestValidator.equals(
    "same-host overlapping exclusions duplicate once",
    count(localResult, "graph-duplicate-exclusion"),
    1,
  );

  // Refusing exclusions removes only that answer and leaves each host's positive obligation visible.
  const strictChecklist = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: exclusions,
        unitIds: [excluded.id, localEvidence.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [hardcoding.id, whackAMole.id],
            resolutions: await resolveAll(exclusions, requirements, [
              hardcoding.id,
              whackAMole.id,
            ]),
            checklist: true,
            noEvidenceExclude: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "strict checklist refuses exclusion coverage",
    TestGraph.hostCoverage(strictChecklist, 0, 0, excluded.id).missingUnitIds,
    [hardcoding.id, whackAMole.id],
  );
  TestValidator.equals(
    "strict checklist reports the exclusion",
    count(strictChecklist, "graph-forbidden-exclusion"),
    1,
  );

  // An unselected carrier can answer an ordinary sibling reference but cannot clear any host's checklist.
  const carrierClaim = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/carrier.ts",
      dedent`
        export function owing(): void {}

        /** @evidenceExclude ../docs/rules.md#["no-hardcoding"] Shared exclusion. */
        export const carrier = true;
      `,
    ),
  );
  const owing = requireUnit(carrierClaim, "owing");
  const carrierResolutions = await resolveAll(carrierClaim, requirements, [
    hardcoding.id,
  ]);
  const unhosted = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: carrierClaim,
        unitIds: [owing.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [hardcoding.id],
            resolutions: carrierResolutions,
            checklist: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "unconsumed carrier is reported once",
    count(unhosted, "graph-unhosted-checklist"),
    1,
  );

  const sharedCarrier = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: carrierClaim,
        unitIds: [owing.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [hardcoding.id],
            resolutions: carrierResolutions,
            checklist: true,
          },
          {
            severity: "error",
            inventory: requirements,
            unitIds: [hardcoding.id],
            resolutions: carrierResolutions,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "shared carrier does not answer checklist host",
    TestGraph.hostCoverage(sharedCarrier, 0, 0, owing.id).missingUnitIds,
    [hardcoding.id],
  );
  TestValidator.equals(
    "shared carrier answers ordinary reference",
    TestGraph.obligation(sharedCarrier, 0, 1).missingUnitIds,
    [],
  );
  TestValidator.equals(
    "ordinary consumption suppresses unhosted duplicate",
    count(sharedCarrier, "graph-unhosted-checklist"),
    0,
  );

  // A failed sibling may have consumed the carrier, while a healthy empty sibling cannot.
  const uncertainRequirements = structuredClone(requirements);
  uncertainRequirements.complete = false;
  uncertainRequirements.diagnostics.push({
    code: "source-unreadable",
    severity: "error",
    message: "The sibling reference could not be read.",
    repair: "Restore access to the sibling reference.",
  });
  const uncertainCarrier = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: carrierClaim,
        unitIds: [owing.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [hardcoding.id],
            resolutions: carrierResolutions,
            checklist: true,
          },
          {
            severity: "error",
            inventory: uncertainRequirements,
            unitIds: [hardcoding.id],
            resolutions: [],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "failed sibling withholds unhosted conclusion",
    count(uncertainCarrier, "graph-unhosted-checklist"),
    0,
  );

  const emptyCarrier = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: carrierClaim,
        unitIds: [owing.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [hardcoding.id],
            resolutions: carrierResolutions,
            checklist: true,
          },
          {
            severity: "error",
            inventory: {
              ...requirements,
              units: [],
              addresses: [],
              hosts: [],
            },
            unitIds: [],
            resolutions: [],
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "healthy empty sibling preserves unhosted conclusion",
    count(emptyCarrier, "graph-unhosted-checklist"),
    1,
  );

  // A refused aggregate has its own repair, so it consumes a deferred unhosted report.
  const aggregateCarrierClaim = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/aggregate-carrier.ts",
      dedent`
        export function owesAggregate(): void {}

        /** @evidence ../docs/rules.md Answers every rule at once. */
        export const aggregateCarrier = true;
      `,
    ),
  );
  const owesAggregate = requireUnit(aggregateCarrierClaim, "owesAggregate");
  const aggregateCarrier = requireUnit(
    aggregateCarrierClaim,
    "aggregateCarrier",
  );
  const aggregateCarrierResolutions = await resolveAll(
    aggregateCarrierClaim,
    requirements,
    [hardcoding.id],
  );
  const answeredAggregate = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: aggregateCarrierClaim,
        unitIds: [owesAggregate.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [hardcoding.id],
            resolutions: aggregateCarrierResolutions,
            checklist: true,
          },
        ],
      },
      {
        severity: "error",
        inventory: aggregateCarrierClaim,
        unitIds: [aggregateCarrier.id],
        references: [
          {
            severity: "error",
            inventory: requirements,
            unitIds: [hardcoding.id],
            resolutions: aggregateCarrierResolutions,
            checklist: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "refused aggregate supplies one direct finding",
    count(answeredAggregate, "graph-checklist-aggregate"),
    1,
  );
  TestValidator.equals(
    "refused aggregate suppresses deferred unhosted finding",
    count(answeredAggregate, "graph-unhosted-checklist"),
    0,
  );

  // Failed and empty populations stop before deriving per-host checklist findings.
  const failedRequirements = structuredClone(requirements);
  failedRequirements.complete = false;
  failedRequirements.diagnostics.push({
    code: "source-unreadable",
    severity: "error",
    message: "The Markdown file could not be read.",
    repair: "Restore access to the Markdown file.",
  });
  const failedChecklist = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claims,
        unitIds: [empty.id],
        references: [
          {
            severity: "error",
            inventory: failedRequirements,
            unitIds: [hardcoding.id],
            resolutions: [],
            checklist: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "failed checklist remains incomplete",
    TestGraph.obligation(failedChecklist, 0, 0).complete,
    false,
  );
  TestValidator.equals(
    "failed checklist has no derivative finding",
    count(failedChecklist, "graph-checklist-missing"),
    0,
  );

  const emptyChecklist = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: claims,
        unitIds: [empty.id],
        references: [
          {
            severity: "error",
            inventory: {
              ...requirements,
              units: [],
              addresses: [],
              hosts: [],
            },
            unitIds: [],
            resolutions: [],
            checklist: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "empty checklist reports only the population",
    emptyChecklist.diagnostics.map((diagnostic) => diagnostic.code),
    ["graph-empty-reference"],
  );
  TestValidator.equals(
    "empty checklist has no host ledger",
    TestGraph.obligation(emptyChecklist, 0, 0).hostCoverage,
    [],
  );
}

async function resolveAll(
  claim: IEvidenceInventory,
  reference: IEvidenceInventory,
  unitIds: string[],
): Promise<IEvidenceGraphResolution[]> {
  const resolver = new EvidenceTargetResolver([reference]);
  const output: IEvidenceGraphResolution[] = [];
  for (const declaration of claim.declarations)
    output.push({
      declarationId: declaration.id,
      resolution: await resolver.resolve(
        declaration,
        requireHost(claim, declaration.hostId),
        unitIds,
      ),
    });
  return output;
}

function requireUnit(
  inventory: IEvidenceInventory,
  identity: string,
): IEvidenceUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.symbol === identity ||
      candidate.name === identity ||
      candidate.identity.at(-1) === identity,
  );
  if (unit === undefined)
    throw new Error(`Missing checklist unit: ${identity}`);
  return unit;
}

function requireHost(inventory: IEvidenceInventory, id: string): IEvidenceHost {
  const host = inventory.hosts.find((candidate) => candidate.id === id);
  if (host === undefined) throw new Error(`Missing checklist host: ${id}`);
  return host;
}

function count(
  result: ReturnType<typeof EvidenceGraph.evaluate>,
  code: string,
): number {
  return result.diagnostics.filter((diagnostic) => diagnostic.code === code)
    .length;
}
