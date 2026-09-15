import {
  EvidFingerprint,
  EvidGraph,
  EvidMarkdownAdapter,
  EvidSwaggerAdapter,
  EvidTargetResolver,
  EvidTypeScriptAdapter,
} from "evid";
import type {
  IEvidDeclaration,
  IEvidHost,
  IEvidInventory,
  IEvidUnit,
} from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestGraph } from "../../internal/EvidTestGraph";
import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Evaluates Swagger as a claim and cross-artifact reference.
 *
 * Operations can supply or require evidence, while reviewed targets remain
 * distinct from acknowledged coverage.
 *
 * 1. Build Swagger and counterpart claim inventories.
 * 2. Resolve supported, missing, and review-only operations.
 * 3. Verify graph outcomes and resolution statuses.
 */
export async function test_swagger_graph(): Promise<void> {
  const specification = await new EvidMarkdownAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "docs/spec.md",
      dedent`
        ## Members {#members}

        Create one member from a validated request.
      `,
    ),
  );
  const members = requireUnit(specification, "members");
  const specificationFingerprint = EvidFingerprint.inspect(
    specification,
    members.id,
  ).fingerprint;

  // The operation description claims the Markdown requirement and records its review.
  const swagger = await new EvidSwaggerAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "openapi.yaml",
      swaggerDocument(dedent`
        Creates a member.

        @evidence docs/spec.md#members Implements the member requirement.
        @evidenceReview docs/spec.md#members #${specificationFingerprint} Read the requirement and checked the API contract.
      `),
    ),
  );
  const operation = requireUnit(swagger, "POST:/members");
  const operationFingerprint = EvidFingerprint.inspect(
    swagger,
    operation.id,
  ).fingerprint;

  // A TypeScript claim can cite the file-independent Swagger operation target.
  const client = await new EvidTypeScriptAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/client.ts",
      dedent`
        /**
         * @evidence POST:/members Calls the documented API operation.
         * @evidenceReview POST:/members #${operationFingerprint} Read the normalized operation and request schema.
         */
        export function createMember(): void {}
      `,
    ),
  );
  const createMember = requireUnit(client, "createMember");
  const graph = EvidGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: swagger,
        unitIds: [operation.id],
        references: [
          {
            severity: "error",
            inventory: specification,
            unitIds: [members.id],
            resolutions: await EvidTestGraph.resolveDeclarations(
              swagger,
              specification,
              [members.id],
            ),
            reviewResolutions: await EvidTestGraph.resolveReviews(
              swagger,
              specification,
              [members.id],
            ),
            requireReview: true,
          },
        ],
      },
      {
        severity: "error",
        inventory: client,
        unitIds: [createMember.id],
        references: [
          {
            severity: "error",
            inventory: swagger,
            unitIds: [operation.id],
            resolutions: await EvidTestGraph.resolveDeclarations(
              client,
              swagger,
              [operation.id],
            ),
            reviewResolutions: await EvidTestGraph.resolveReviews(
              client,
              swagger,
              [operation.id],
            ),
            requireReview: true,
          },
        ],
      },
    ],
  });

  TestValidator.equals(
    "cross-artifact Swagger diagnostics",
    graph.diagnostics,
    [],
  );
  TestValidator.predicate(
    "cross-artifact Swagger graph succeeds",
    graph.success,
  );

  // Target grammar and exact operation lookup report distinct failures.
  const failures = await new EvidTypeScriptAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "src/failures.ts",
      dedent`
        /** @evidence POST /members Contains whitespace instead of a colon. */
        export function spaced(): void {}

        /** @evidence post:/members Uses a lowercase method. */
        export function lowercase(): void {}

        /** @evidence POST:/Members Changes the exact path spelling. */
        export function missing(): void {}
      `,
    ),
  );
  const resolver = new EvidTargetResolver([swagger]);
  const unitIds = [operation.id];
  TestValidator.equals(
    "spaced Swagger target",
    (
      await resolver.resolve(
        requireDeclaration(failures, "POST"),
        requireHost(failures, requireDeclaration(failures, "POST")),
        unitIds,
      )
    ).status,
    "malformed",
  );
  TestValidator.equals(
    "lowercase Swagger target",
    (
      await resolver.resolve(
        requireDeclaration(failures, "post:/members"),
        requireHost(failures, requireDeclaration(failures, "post:/members")),
        unitIds,
      )
    ).status,
    "malformed",
  );
  TestValidator.equals(
    "case-distinct Swagger path",
    (
      await resolver.resolve(
        requireDeclaration(failures, "POST:/Members"),
        requireHost(failures, requireDeclaration(failures, "POST:/Members")),
        unitIds,
      )
    ).status,
    "missing-member",
  );

  // Equal addresses in separate documents become ambiguous when selected together.
  const duplicate = await new EvidSwaggerAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "duplicate.yaml",
      swaggerDocument("Duplicate."),
    ),
  );
  const duplicateOperation = requireUnit(duplicate, "POST:/members");
  const ambiguous = new EvidTargetResolver([swagger, duplicate]);
  const declaration = requireDeclaration(client, "POST:/members");
  TestValidator.equals(
    "separate document ambiguity",
    (
      await ambiguous.resolve(declaration, requireHost(client, declaration), [
        operation.id,
        duplicateOperation.id,
      ])
    ).status,
    "ambiguous",
  );
}

function swaggerDocument(description: string): string {
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
                  type: object
                  properties:
                    name:
                      type: string
          responses:
            "204":
              description: Created
  `;
}

function requireUnit(inventory: IEvidInventory, identity: string): IEvidUnit {
  const unit = inventory.units.find(
    (candidate) =>
      candidate.name === identity || candidate.identity.at(-1) === identity,
  );
  if (unit === undefined) throw new Error(`Missing graph unit: ${identity}`);
  return unit;
}

function requireDeclaration(
  inventory: IEvidInventory,
  target: string,
): IEvidDeclaration {
  const declaration = inventory.declarations.find(
    (candidate) => candidate.target === target,
  );
  if (declaration === undefined)
    throw new Error(`Missing Swagger graph declaration: ${target}`);
  return declaration;
}

function requireHost(
  inventory: IEvidInventory,
  declaration: IEvidDeclaration,
): IEvidHost {
  const host = inventory.hosts.find(
    (candidate) => candidate.id === declaration.hostId,
  );
  if (host === undefined)
    throw new Error(`Missing Swagger graph host: ${declaration.hostId}`);
  return host;
}
