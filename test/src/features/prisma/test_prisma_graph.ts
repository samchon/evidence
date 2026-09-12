import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceFingerprint } from "../../../../packages/evidence/src/EvidenceFingerprint";
import { EvidenceGraph } from "../../../../packages/evidence/src/EvidenceGraph";
import { EvidenceMarkdownAdapter } from "../../../../packages/evidence/src/EvidenceMarkdownAdapter";
import { EvidencePrismaAdapter } from "../../../../packages/evidence/src/EvidencePrismaAdapter";
import { EvidenceTargetResolver } from "../../../../packages/evidence/src/EvidenceTargetResolver";
import { EvidenceTypeScriptAdapter } from "../../../../packages/evidence/src/EvidenceTypeScriptAdapter";
import type { IEvidenceDeclaration } from "../../../../packages/evidence/src/structures/IEvidenceDeclaration";
import type { IEvidenceHost } from "../../../../packages/evidence/src/structures/IEvidenceHost";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Evaluates Prisma as both a claim and a reviewed reference. */
export async function test_prisma_graph(): Promise<void> {
  const specification = await new EvidenceMarkdownAdapter().analyze(
    TestSourceSnapshot.create(
      "docs/spec.md",
      dedent`
        ## Pricing {#pricing}

        Persist the price of every sale.

        ## Sellers {#sellers}

        Seller identity belongs to the authentication service.
      `,
    ),
  );
  const pricing = requireUnit(specification, "pricing");
  const sellers = requireUnit(specification, "sellers");
  const pricingFingerprint = EvidenceFingerprint.inspect(
    specification,
    pricing.id,
  ).fingerprint;
  const sellersFingerprint = EvidenceFingerprint.inspect(
    specification,
    sellers.id,
  ).fingerprint;

  // Prisma claims the persisted model and excludes an external responsibility in a ledger.
  const prisma = await new EvidencePrismaAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "prisma/schema.prisma",
        dedent`
          datasource db {
            provider = "postgresql"
          }

          /// @evidence docs/spec.md#pricing The model persists the requested price.
          /// @evidenceReview docs/spec.md#pricing #${pricingFingerprint} Read the pricing requirement and checked the stored fields.
          model Sale {
            id    String @id
            price Int
          }

          model Seller {
            id String @id
          }
        `,
      ),
      TestSourceSnapshot.create(
        "prisma/exclusions.schema",
        dedent`
          /// @evidenceExclude docs/spec.md#sellers Authentication owns seller identity.
          /// @evidenceExcludeReview docs/spec.md#sellers #${sellersFingerprint} Read the ownership boundary and confirmed the exclusion.
        `,
      ),
    ]),
  );
  const sale = requireUnit(prisma, "prisma:Sale");
  const seller = requireUnit(prisma, "prisma:Seller");
  const saleFingerprint = EvidenceFingerprint.inspect(
    prisma,
    sale.id,
  ).fingerprint;
  const sellerFingerprint = EvidenceFingerprint.inspect(
    prisma,
    seller.id,
  ).fingerprint;

  // TypeScript then cites the file-independent Prisma model targets.
  const contract = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/contracts.ts",
      dedent`
        /**
         * @evidence prisma:Sale Exposes the persisted sale model.
         * @evidenceReview prisma:Sale #${saleFingerprint} Read the model and its stored fields.
         * @evidence prisma:Seller Exposes the persisted seller model.
         * @evidenceReview prisma:Seller #${sellerFingerprint} Read the seller identity contract.
         */
        export interface ISaleContract {}
      `,
    ),
  );
  const contractUnit = requireUnit(contract, "ISaleContract");

  const graph = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: prisma,
        unitIds: [sale.id, seller.id],
        references: [
          {
            severity: "error",
            inventory: specification,
            unitIds: [pricing.id, sellers.id],
            resolutions: await TestGraph.resolveDeclarations(
              prisma,
              specification,
              [pricing.id, sellers.id],
            ),
            reviewResolutions: await TestGraph.resolveReviews(
              prisma,
              specification,
              [pricing.id, sellers.id],
            ),
            requireReview: true,
          },
        ],
      },
      {
        severity: "error",
        inventory: contract,
        unitIds: [contractUnit.id],
        references: [
          {
            severity: "error",
            inventory: prisma,
            unitIds: [sale.id, seller.id],
            resolutions: await TestGraph.resolveDeclarations(contract, prisma, [
              sale.id,
              seller.id,
            ]),
            reviewResolutions: await TestGraph.resolveReviews(
              contract,
              prisma,
              [sale.id, seller.id],
            ),
            requireReview: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "cross-artifact Prisma diagnostics",
    graph.diagnostics,
    [],
  );
  TestValidator.predicate(
    "cross-artifact Prisma graph succeeds",
    graph.success,
  );

  // Prisma target syntax and selected-member lookup remain distinct failures.
  const malformedClaim = await new EvidenceTypeScriptAdapter().analyze(
    TestSourceSnapshot.create(
      "src/failures.ts",
      dedent`
        /** @evidence prisma:Sale..price Contains an empty member segment. */
        export function malformed(): void {}

        /** @evidence prisma:Sale.absent Names no parsed member. */
        export function missing(): void {}
      `,
    ),
  );
  const resolver = new EvidenceTargetResolver([prisma]);
  const malformed = requireDeclaration(malformedClaim, "prisma:Sale..price");
  const missing = requireDeclaration(malformedClaim, "prisma:Sale.absent");
  const ids = prisma.units.map((unit) => unit.id);
  TestValidator.equals(
    "malformed Prisma target",
    (
      await resolver.resolve(
        malformed,
        requireHost(malformedClaim, malformed),
        ids,
      )
    ).status,
    "malformed",
  );
  TestValidator.equals(
    "missing Prisma member",
    await resolver.resolve(missing, requireHost(malformedClaim, missing), ids),
    {
      status: "missing-member",
      addresses: [{ file: "prisma:", segments: ["Sale", "absent"] }],
      units: [],
      withdrawals: [],
      diagnostics: [
        {
          code: "target-missing-member",
          severity: "error",
          message:
            "The selected Prisma schema has no public selected address 'prisma:Sale.absent'.",
          repair:
            "Correct the model or member name, or include its symbol kind in this reference.",
          location: missing.location,
          hostId: missing.hostId,
          target: missing.target,
        },
      ],
    },
  );
}

function requireUnit(
  inventory: IEvidenceInventory,
  identity: string,
): IEvidenceUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.id === identity || candidate.identity.at(-1) === identity,
  );
  if (unit === undefined)
    throw new Error(`Missing Prisma graph unit: ${identity}`);
  return unit;
}

function requireDeclaration(
  inventory: IEvidenceInventory,
  target: string,
): IEvidenceDeclaration {
  const declaration = inventory.declarations.find(
    (candidate) => candidate.target === target,
  );
  if (declaration === undefined)
    throw new Error(`Missing Prisma graph declaration: ${target}`);
  return declaration;
}

function requireHost(
  inventory: IEvidenceInventory,
  declaration: IEvidenceDeclaration,
): IEvidenceHost {
  const host = inventory.hosts.find(
    (candidate) => candidate.id === declaration.hostId,
  );
  if (host === undefined)
    throw new Error(`Missing Prisma graph host: ${declaration.hostId}`);
  return host;
}
