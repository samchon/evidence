import {
  EvidenceFingerprint,
  EvidenceSwaggerAdapter,
} from "@wrtnlabs/evidence";
import type { IEvidenceInventory, IEvidenceUnit } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Tracks normalized operation content through component and description edits. */
export async function test_swagger_fingerprints(): Promise<void> {
  const baseline = await analyze(document("Creates a member.", "string"));
  const post = fingerprint(baseline, "POST:/members");
  const health = fingerprint(baseline, "GET:/health");

  // A referenced DTO belongs to the operation content that review fingerprints protect.
  const changedComponent = await analyze(
    document("Creates a member.", "integer"),
  );
  TestValidator.equals(
    "referenced component expires operation review",
    fingerprint(changedComponent, "POST:/members") === post,
    false,
  );
  TestValidator.equals(
    "unrelated operation survives component edit",
    fingerprint(changedComponent, "GET:/health"),
    health,
  );

  // Evidence metadata can be added after prose without invalidating its own review.
  const annotated = await analyze(
    document(
      dedent`
        Creates a member.

        @evidence docs/requirements.md#members Implements member creation.
        @evidenceReview docs/requirements.md#members #abcdef0 Read the requirement.
      `,
      "string",
    ),
  );
  TestValidator.equals(
    "description annotations do not alter semantic content",
    fingerprint(annotated, "POST:/members"),
    post,
  );

  const changedProse = await analyze(
    document("Creates and validates a member.", "string"),
  );
  TestValidator.equals(
    "description prose expires operation review",
    fingerprint(changedProse, "POST:/members") === post,
    false,
  );

  // Recursive local component references terminate and remain deterministic.
  const repeated = await analyze(document("Creates a member.", "string"));
  TestValidator.equals(
    "recursive component fingerprint is deterministic",
    fingerprint(repeated, "POST:/members"),
    post,
  );
}

async function analyze(content: string): Promise<IEvidenceInventory> {
  return new EvidenceSwaggerAdapter().analyze(
    TestSourceSnapshot.create("openapi.yaml", content),
  );
}

function fingerprint(inventory: IEvidenceInventory, target: string): string {
  const unit = requireUnit(inventory, target);
  return EvidenceFingerprint.inspect(inventory, unit.id).fingerprint;
}

function requireUnit(
  inventory: IEvidenceInventory,
  target: string,
): IEvidenceUnit {
  const unit = inventory.units.find((candidate) => candidate.name === target);
  if (unit === undefined)
    throw new Error(`Missing Swagger operation: ${target}`);
  return unit;
}

function document(description: string, identifierType: string): string {
  return dedent`
    openapi: 3.1.0
    info:
      title: Members
      version: 1.0.0
    paths:
      /members:
        post:
          description: ${JSON.stringify(description)}
          requestBody:
            content:
              application/json:
                schema:
                  $ref: "#/components/schemas/MemberInput"
          responses:
            "204":
              description: Created
      /health:
        get:
          responses:
            "200":
              description: Healthy
    components:
      schemas:
        MemberInput:
          type: object
          properties:
            id:
              type: ${identifierType}
            parent:
              $ref: "#/components/schemas/MemberInput"
  `;
}
