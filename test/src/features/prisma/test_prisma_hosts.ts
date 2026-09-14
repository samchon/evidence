import { EvidenceInventory, EvidencePrismaAdapter } from "@wrtnlabs/evidence";
import type {
  IEvidenceDeclaration,
  IEvidenceHost,
  IEvidenceInventory,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Preserves Prisma documentation hosts, withdrawals, and exclusion ledgers. */
export async function test_prisma_hosts(): Promise<void> {
  const schema = dedent`
    datasource db {
      provider = "postgresql"
    }

    /// @evidence docs/spec.md#sale The sale model implements the requirement.
    // Prisma retains the surrounding documentation run.
    model Sale {
      id String @id
      brace String @default("}")

      /** @evidence docs/spec.md#price The column stores the required amount. */
      price Int

      /* @evidence docs/spec.md#plain Plain block documentation is supported. */
      plain String

      /// @evidence docs/spec.md#note The note remains documented across a blank line.

      note String

      /// @evidence docs/spec.md#index This comment documents no field.
      @@index([price])
    }

    /// @hidden Internal persistence detail.
    /// @evidence docs/spec.md#seller A withdrawn model cannot claim evidence.
    model Seller {
      id String @id
    }

    /// @evidence docs/spec.md#status Enums are outside the Evidence population.
    enum SaleStatus {
      ACTIVE
    }

    // @evidence docs/spec.md#line Prisma discards this comment.
    model LineOnly {
      id String @id
    }

    //// @evidence docs/spec.md#buried A fourth slash buries this tag.
    model Buried {
      id String @id
    }
  `;
  const ledger = dedent`
    /// @evidenceExclude docs/spec.md#deferred Persistence is intentionally deferred.
    /// @evidenceExcludeReview docs/spec.md#deferred Reviewed the deferral.
    /// @evidence docs/spec.md#misplaced Positive evidence needs a declaration host.
  `;
  const inventory = await new EvidencePrismaAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "prisma/schema.prisma",
        schema.replaceAll("\n", "\r\n"),
      ),
      TestSourceSnapshot.create("prisma/exclusions.schema", ledger),
    ]),
  );

  TestValidator.equals(
    "supported Prisma declarations",
    inventory.declarations
      .map(
        (declaration) =>
          `${declaration.kind}:${declaration.target}:${requireHost(inventory, declaration).unitIds.join(",")}`,
      )
      .sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)),
    [
      "evidence:docs/spec.md#note:prisma:Sale.note",
      "evidence:docs/spec.md#plain:prisma:Sale.plain",
      "evidence:docs/spec.md#price:prisma:Sale.price",
      "evidence:docs/spec.md#sale:prisma:Sale",
      "evidenceExclude:docs/spec.md#deferred:",
    ],
  );

  // The file-level run remains a real exclusion host and its review is retained.
  const exclusion = requireDeclaration(inventory, "docs/spec.md#deferred");
  const carrier = requireHost(inventory, exclusion);
  TestValidator.equals(
    "file exclusion carrier attachment",
    carrier.attachment,
    "attached",
  );
  TestValidator.equals(
    "file exclusion carrier has no semantic unit",
    carrier.unitIds,
    [],
  );
  TestValidator.equals(
    "file exclusion review",
    inventory.reviews.map((review) => [review.reviews, review.target]),
    [["evidenceExclude", "docs/spec.md#deferred"]],
  );

  // Documentation maps retain the source line where each declaration was written.
  TestValidator.equals(
    "Prisma declaration source lines",
    [
      requireLine(requireDeclaration(inventory, "docs/spec.md#sale")),
      requireLine(requireDeclaration(inventory, "docs/spec.md#price")),
      requireLine(requireDeclaration(inventory, "docs/spec.md#note")),
    ],
    [5, 11, 17],
  );

  // A model withdrawal removes the model and every member from public selection.
  const selection = new EvidenceInventory([inventory]).select([
    "prisma:Seller",
    "prisma:Seller.id",
  ]);
  TestValidator.equals(
    "withdrawal propagates through model descendants",
    selection.hidden.map((unit) => unit.id),
    ["prisma:Seller", "prisma:Seller.id"],
  );

  TestValidator.equals(
    "misplaced Prisma annotations are reported",
    inventory.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "prisma-buried-annotation",
      "prisma-file-evidence",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
      "unsupported-annotation-host",
    ],
  );
  const buried = inventory.diagnostics.find(
    (diagnostic) => diagnostic.code === "prisma-buried-annotation",
  );
  if (buried?.location?.range === undefined)
    throw new Error("Missing buried Prisma annotation range.");
  TestValidator.equals(
    "buried Prisma annotation source line",
    buried.location.range.start.line,
    41,
  );
}

function requireDeclaration(
  inventory: IEvidenceInventory,
  target: string,
): IEvidenceDeclaration {
  const declaration = inventory.declarations.find(
    (candidate) => candidate.target === target,
  );
  if (declaration === undefined)
    throw new Error(`Missing Prisma declaration: ${target}`);
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
    throw new Error(`Missing Prisma declaration host: ${declaration.hostId}`);
  return host;
}

function requireLine(declaration: IEvidenceDeclaration): number {
  const range = declaration.location.range;
  if (range === undefined)
    throw new Error(`Missing Prisma declaration range: ${declaration.target}`);
  return range.start.line;
}
