import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceFingerprint } from "../../../../packages/evidence/src/EvidenceFingerprint";
import { EvidencePrismaAdapter } from "../../../../packages/evidence/src/EvidencePrismaAdapter";
import type { IEvidenceInventory } from "../../../../packages/evidence/src/structures/IEvidenceInventory";
import type { IEvidenceSourceFile } from "../../../../packages/evidence/src/structures/IEvidenceSourceFile";
import type { IEvidenceUnit } from "../../../../packages/evidence/src/structures/IEvidenceUnit";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Uses Prisma's parser for model, view, column, and relation identities. */
export async function test_prisma_units(): Promise<void> {
  const baseline = await analyze(false, "Int");

  TestValidator.equals(
    "Prisma semantic units",
    baseline.units.map((unit) => [unit.id, unit.parentId, unit.symbol]),
    [
      ["prisma:Sale", undefined, "model"],
      ["prisma:Sale.id", "prisma:Sale", "column"],
      ["prisma:Sale.price", "prisma:Sale", "column"],
      ["prisma:Sale.seller", "prisma:Sale", "relation"],
      ["prisma:Sale.sellerId", "prisma:Sale", "column"],
      ["prisma:Sale.status", "prisma:Sale", "column"],
      ["prisma:SaleSummary", undefined, "model"],
      ["prisma:SaleSummary.id", "prisma:SaleSummary", "column"],
      ["prisma:SaleSummary.total", "prisma:SaleSummary", "column"],
      ["prisma:Seller", undefined, "model"],
      ["prisma:Seller.id", "prisma:Seller", "column"],
      ["prisma:Seller.sales", "prisma:Seller", "relation"],
    ],
  );

  // A relation back-reference has no local @relation attribute; only the parser classifies it.
  TestValidator.equals(
    "relation back-reference",
    requireUnit(baseline, "prisma:Seller.sales").symbol,
    "relation",
  );
  TestValidator.equals(
    "enum declaration is not a unit",
    baseline.units.some((unit) => unit.id === "prisma:SaleStatus"),
    false,
  );

  // One physical source with two logical addresses must enter the parser only once.
  TestValidator.equals(
    "physical schema aliases",
    requireSource(baseline, "source:prisma/core.prisma").addresses.length,
    2,
  );

  const moved = await analyze(true, "Int");
  const originalSale = requireUnit(baseline, "prisma:Sale");
  const movedSale = requireUnit(moved, "prisma:Sale");

  TestValidator.equals(
    "model target survives a file move",
    movedSale.id,
    originalSale.id,
  );
  TestValidator.equals(
    "model fingerprint survives a file move",
    EvidenceFingerprint.inspect(moved, movedSale.id).fingerprint,
    EvidenceFingerprint.inspect(baseline, originalSale.id).fingerprint,
  );

  // Member semantics affect the model subtree without changing the model's own digest.
  const changed = await analyze(false, "BigInt");
  const changedSale = requireUnit(changed, "prisma:Sale");
  TestValidator.equals(
    "model declaration digest excludes member content",
    changedSale.contentDigest,
    originalSale.contentDigest,
  );
  TestValidator.notEquals(
    "model fingerprint includes member content",
    EvidenceFingerprint.inspect(changed, changedSale.id).fingerprint,
    EvidenceFingerprint.inspect(baseline, originalSale.id).fingerprint,
  );
}

async function analyze(
  moved: boolean,
  priceType: string,
): Promise<IEvidenceInventory> {
  const header = dedent`
    generator client {
      provider        = "prisma-client-js"
      previewFeatures = ["views"]
    }

    datasource db {
      provider = "postgresql"
    }

    enum SaleStatus {
      ACTIVE
      CLOSED
    }

    view SaleSummary {
      id    String @unique
      total Int
    }
  `;
  const sale = dedent`
    model Sale {
      id       String     @id
      price    ${priceType}
      status   SaleStatus
      sellerId String
      seller   Seller     @relation(fields: [sellerId], references: [id])
    }
  `;
  const seller = dedent`
    model Seller {
      id    String @id
      sales Sale[]
    }
  `;
  const core = TestSourceSnapshot.create(
    "prisma/core.prisma",
    moved ? header : `${header}\n\n${sale}`,
    ["prisma/core.prisma", "schema/core.prisma"],
  );
  const relations = TestSourceSnapshot.create(
    "prisma/relations.schema",
    moved ? `${sale}\n\n${seller}` : seller,
  );
  return new EvidencePrismaAdapter().analyze(
    TestSourceSnapshot.combine([core, relations]),
  );
}

function requireUnit(inventory: IEvidenceInventory, id: string): IEvidenceUnit {
  const unit = inventory.units.find((candidate) => candidate.id === id);
  if (unit === undefined) throw new Error(`Missing Prisma unit: ${id}`);
  return unit;
}

function requireSource(
  inventory: IEvidenceInventory,
  id: string,
): IEvidenceSourceFile {
  const source = inventory.sources.find((candidate) => candidate.id === id);
  if (source === undefined) throw new Error(`Missing Prisma source: ${id}`);
  return source;
}
