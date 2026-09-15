import {
  EvidenceFingerprint,
  EvidenceGraph,
  EvidenceSwaggerAdapter,
  EvidenceTypeScriptAdapter,
} from "@wrtnlabs/evidence";
import type {
  IEvidenceGraphReference,
  IEvidenceGraphResult,
  IEvidenceDiagnostic,
  IEvidenceInventory,
  IEvidenceUnit,
} from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";
import { EvidenceTestGraph } from "../../internal/EvidenceTestGraph";

/**
 * Tracks Swagger operation fingerprints through normalized content edits.
 *
 * Component references, effective servers, security requirements, and operation
 * descriptions affect review meaning through normalized operation content.
 *
 * 1. Analyze an operation with referenced components and descriptions.
 * 2. Apply component, unresolved reference, and description edits.
 * 3. Compare omitted and empty root server/security defaults, then change root,
 *    path, and operation server scopes plus inherited security; require only
 *    operations whose effective contract changes to expire.
 * 4. Change ordinary, OAuth, and prototype-shaped used security definitions while
 *    editing an unused scheme; require only referenced authentication contracts
 *    to affect the digest.
 * 5. Reorder security alternatives, schemes, and scopes without expiring the
 *    review, then change their membership and preserve server ordering.
 * 6. Repeat effective server and security mutations through Swagger 2.0 conversion
 *    and require the normalized operation hash to move.
 * 7. Exercise `requireReview` with the old hash after a root server change and
 *    require a stale-review diagnostic rather than a passing obsolete review.
 * 8. Verify the expected description stability or invalidation.
 */
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

  const prototypeReference: IEvidenceInventory = await analyze(
    unresolvedReferenceDocument("toString"),
  );
  const secondPrototypeReference: IEvidenceInventory = await analyze(
    unresolvedReferenceDocument("valueOf"),
  );
  TestValidator.notEquals(
    "unresolved prototype-shaped references retain their token",
    fingerprint(prototypeReference, "POST:/members"),
    fingerprint(secondPrototypeReference, "POST:/members"),
  );

  const implicitDefaults: IEvidenceInventory = await analyze(
    defaultDocument(false),
  );
  const explicitDefaults: IEvidenceInventory = await analyze(defaultDocument(true));
  TestValidator.equals(
    "empty root defaults preserve effective contract",
    fingerprint(explicitDefaults, "GET:/defaults"),
    fingerprint(implicitDefaults, "GET:/defaults"),
  );

  // Effective root defaults and the definitions they name belong to the using operation.
  const effective: IEvidenceInventory = await analyze(
    effectiveDocument(
      "https://first.example",
      "https://path.example",
      "key",
      "X-First",
      "Unused-First",
    ),
  );
  const inherited: string = fingerprint(effective, "GET:/inherited");
  const pathInherited: string = fingerprint(effective, "GET:/path-server");
  const overridden: string = fingerprint(effective, "GET:/overridden");
  const changedServer: IEvidenceInventory = await analyze(
    effectiveDocument(
      "https://second.example",
      "https://path.example",
      "key",
      "X-First",
      "Unused-First",
    ),
  );
  const changedPathServer: IEvidenceInventory = await analyze(
    effectiveDocument(
      "https://first.example",
      "https://changed-path.example",
      "key",
      "X-First",
      "Unused-First",
    ),
  );
  const changedScheme: IEvidenceInventory = await analyze(
    effectiveDocument(
      "https://first.example",
      "https://path.example",
      "key",
      "X-Second",
      "Unused-First",
    ),
  );
  const changedUnusedScheme: IEvidenceInventory = await analyze(
    effectiveDocument(
      "https://first.example",
      "https://path.example",
      "key",
      "X-First",
      "Unused-Second",
    ),
  );
  const changedRequirement: IEvidenceInventory = await analyze(
    effectiveDocument(
      "https://first.example",
      "https://path.example",
      "alternate",
      "X-First",
      "Unused-First",
    ),
  );

  TestValidator.equals(
    "inherited server expires operation review",
    fingerprint(changedServer, "GET:/inherited") === inherited,
    false,
  );
  TestValidator.equals(
    "used security scheme expires operation review",
    fingerprint(changedScheme, "GET:/inherited") === inherited,
    false,
  );
  TestValidator.equals(
    "unused security scheme preserves operation review",
    fingerprint(changedUnusedScheme, "GET:/inherited"),
    inherited,
  );
  TestValidator.equals(
    "operation overrides isolate root changes",
    [
      fingerprint(changedServer, "GET:/overridden"),
      fingerprint(changedScheme, "GET:/overridden"),
    ],
    [overridden, overridden],
  );
  TestValidator.equals(
    "path server isolates root server change",
    fingerprint(changedServer, "GET:/path-server"),
    pathInherited,
  );
  TestValidator.notEquals(
    "path server change expires using operation",
    fingerprint(changedPathServer, "GET:/path-server"),
    pathInherited,
  );
  TestValidator.equals(
    "path server change leaves root operation stable",
    fingerprint(changedPathServer, "GET:/inherited"),
    inherited,
  );
  TestValidator.notEquals(
    "root security requirement expires operation review",
    fingerprint(changedRequirement, "GET:/inherited"),
    inherited,
  );

  const oauth: IEvidenceInventory = await analyze(
    oauthDocument("https://identity.example/first"),
  );
  const changedOauth: IEvidenceInventory = await analyze(
    oauthDocument("https://identity.example/second"),
  );
  TestValidator.notEquals(
    "used OAuth flow expires operation review",
    fingerprint(changedOauth, "GET:/oauth"),
    fingerprint(oauth, "GET:/oauth"),
  );

  const prototypeSecurity: IEvidenceInventory = await analyze(
    prototypeSecurityDocument("X-First"),
  );
  const changedPrototypeSecurity: IEvidenceInventory = await analyze(
    prototypeSecurityDocument("X-Second"),
  );
  TestValidator.notEquals(
    "prototype-shaped security name retains its definition",
    fingerprint(changedPrototypeSecurity, "GET:/prototype-security"),
    fingerprint(prototypeSecurity, "GET:/prototype-security"),
  );

  const orderedSecurity: IEvidenceInventory = await analyze(
    securityOrderDocument(false, false),
  );
  const reorderedSecurity: IEvidenceInventory = await analyze(
    securityOrderDocument(true, false),
  );
  const changedSecurityMembership: IEvidenceInventory = await analyze(
    securityOrderDocument(true, true),
  );
  TestValidator.equals(
    "security alternative, scheme, and scope order is presentation-only",
    fingerprint(reorderedSecurity, "GET:/ordered-security"),
    fingerprint(orderedSecurity, "GET:/ordered-security"),
  );
  TestValidator.notEquals(
    "security scope membership expires operation review",
    fingerprint(changedSecurityMembership, "GET:/ordered-security"),
    fingerprint(orderedSecurity, "GET:/ordered-security"),
  );

  const orderedServers: IEvidenceInventory = await analyze(
    serverOrderDocument(false),
  );
  const reorderedServers: IEvidenceInventory = await analyze(
    serverOrderDocument(true),
  );
  TestValidator.notEquals(
    "server preference order remains semantic",
    fingerprint(reorderedServers, "GET:/ordered-servers"),
    fingerprint(orderedServers, "GET:/ordered-servers"),
  );

  const swaggerTwo: IEvidenceInventory = await analyze(
    swaggerTwoDocument("first.example", "X-First"),
  );
  const swaggerTwoServer: IEvidenceInventory = await analyze(
    swaggerTwoDocument("second.example", "X-First"),
  );
  const swaggerTwoScheme: IEvidenceInventory = await analyze(
    swaggerTwoDocument("first.example", "X-Second"),
  );
  TestValidator.notEquals(
    "Swagger 2 server conversion expires review",
    fingerprint(swaggerTwoServer, "GET:/legacy"),
    fingerprint(swaggerTwo, "GET:/legacy"),
  );
  TestValidator.notEquals(
    "Swagger 2 security conversion expires review",
    fingerprint(swaggerTwoScheme, "GET:/legacy"),
    fingerprint(swaggerTwo, "GET:/legacy"),
  );
  const swaggerTwoOrdered: IEvidenceInventory = await analyze(
    swaggerTwoSecurityOrderDocument(false),
  );
  const swaggerTwoReordered: IEvidenceInventory = await analyze(
    swaggerTwoSecurityOrderDocument(true),
  );
  TestValidator.equals(
    "Swagger 2 security order is presentation-only after conversion",
    fingerprint(swaggerTwoReordered, "GET:/legacy-security"),
    fingerprint(swaggerTwoOrdered, "GET:/legacy-security"),
  );

  const reviewedClaim: IEvidenceInventory =
    await new EvidenceTypeScriptAdapter().analyze(
      EvidenceTestSourceSnapshot.create(
        "src/client.ts",
        dedent`
          /**
           * @evidence GET:/inherited Calls the inherited endpoint.
           * @evidenceReview GET:/inherited #${inherited} Reviewed its effective server.
           */
          export function request(): void {}
        `,
      ),
    );
  const changedOperation: IEvidenceUnit = requireUnit(
    changedServer,
    "GET:/inherited",
  );
  const reference: IEvidenceGraphReference = {
    severity: "error",
    inventory: changedServer,
    unitIds: [changedOperation.id],
    resolutions: await EvidenceTestGraph.resolveDeclarations(
      reviewedClaim,
      changedServer,
      [changedOperation.id],
    ),
    reviewResolutions: await EvidenceTestGraph.resolveReviews(
      reviewedClaim,
      changedServer,
      [changedOperation.id],
    ),
    requireReview: true,
  };
  const reviewedUnit: IEvidenceUnit | undefined = reviewedClaim.units.find(
    (unit: IEvidenceUnit): boolean => unit.name === "request",
  );
  if (reviewedUnit === undefined)
    throw new Error("Missing Swagger review claim unit.");
  const reviewResult: IEvidenceGraphResult = EvidenceGraph.evaluate({
    claims: [
      {
        severity: "error",
        inventory: reviewedClaim,
        unitIds: [reviewedUnit.id],
        references: [reference],
      },
    ],
  });
  TestValidator.equals(
    "effective contract change makes old review stale",
    reviewResult.diagnostics.filter(
      (diagnostic: IEvidenceDiagnostic): boolean =>
        diagnostic.code === "graph-stale-review",
    ).length,
    1,
  );
}

/**
 * Analyzes one in-memory OpenAPI fixture through the public Swagger adapter.
 *
 * Every fingerprint comparison uses the same logical source path so only the
 * mutated operation contract can change the result.
 */
async function analyze(content: string): Promise<IEvidenceInventory> {
  return new EvidenceSwaggerAdapter().analyze(
    EvidenceTestSourceSnapshot.create("openapi.yaml", content),
  );
}

/**
 * Returns the presented fingerprint for one required operation target.
 *
 * The helper fails through {@link requireUnit} when a fixture unexpectedly
 * changes the operation population instead of its semantic digest.
 */
function fingerprint(inventory: IEvidenceInventory, target: string): string {
  const unit = requireUnit(inventory, target);
  return EvidenceFingerprint.inspect(inventory, unit.id).fingerprint;
}

/**
 * Requires one Swagger operation with an exact target spelling.
 *
 * Fingerprint fixtures use unique METHOD/path names, so absence is an adapter
 * regression rather than an optional scenario outcome.
 */
function requireUnit(inventory: IEvidenceInventory, target: string): IEvidenceUnit {
  const unit = inventory.units.find((candidate) => candidate.name === target);
  if (unit === undefined)
    throw new Error(`Missing Swagger operation: ${target}`);
  return unit;
}

/**
 * Builds the recursive-schema baseline used for content fingerprint checks.
 *
 * Description and identifier type are independent mutation inputs; the parent
 * reference retains a finite local component cycle in every variant.
 */
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

/**
 * Builds an operation with an unresolved component-shaped reference.
 *
 * Names inherited from `Object.prototype` remain ordinary JSON Pointer
 * segments; changing the unresolved token must still change the reviewed
 * operation.
 */
function unresolvedReferenceDocument(reference: string): string {
  return dedent`
    openapi: 3.1.0
    info:
      title: Unresolved references
      version: 1.0.0
    paths:
      /members:
        post:
          requestBody:
            content:
              application/json:
                schema:
                  $ref: "#/components/schemas/${reference}"
          responses:
            "204":
              description: Created
    components:
      schemas: {}
  `;
}

/**
 * Builds operations that inherit or override server and security scopes.
 *
 * The arguments isolate one effective-contract mutation at a time, including a
 * security definition that remains unused by every operation.
 */
function effectiveDocument(
  server: string,
  pathServer: string,
  security: "alternate" | "key",
  header: string,
  unusedHeader: string,
): string {
  return dedent`
    openapi: 3.1.0
    info:
      title: Effective contracts
      version: 1.0.0
    servers:
      - url: ${server}
    security:
      - ${security}: []
    paths:
      /inherited:
        get:
          responses:
            "200":
              description: OK
      /overridden:
        get:
          servers:
            - url: https://operation.example
          security: []
          responses:
            "200":
              description: OK
      /path-server:
        servers:
          - url: ${pathServer}
        get:
          responses:
            "200":
              description: OK
    components:
      securitySchemes:
        key:
          type: apiKey
          in: header
          name: ${header}
        unused:
          type: apiKey
          in: header
          name: ${unusedHeader}
        alternate:
          type: http
          scheme: bearer
  `;
}

/**
 * Builds equivalent implicit or explicit root-default contracts.
 *
 * Both forms leave the operation unauthenticated and select OpenAPI's `/`
 * server, so their review fingerprints must agree.
 */
function defaultDocument(explicit: boolean): string {
  const document: Record<string, unknown> = {
    openapi: "3.1.0",
    info: { title: "Defaults", version: "1.0.0" },
    paths: {
      "/defaults": {
        get: { responses: { 200: { description: "OK" } } },
      },
    },
  };
  if (explicit) {
    document["servers"] = [];
    document["security"] = [];
  }
  return JSON.stringify(document);
}

/**
 * Builds an operation whose effective requirement names one OAuth scheme.
 *
 * Changing the authorization endpoint then isolates the dependency on a used
 * flow definition from unrelated component state.
 */
function oauthDocument(authorizationUrl: string): string {
  return dedent`
    openapi: 3.1.0
    info:
      title: OAuth
      version: 1.0.0
    security:
      - oauth: [read]
    paths:
      /oauth:
        get:
          responses:
            "200":
              description: OK
    components:
      securitySchemes:
        oauth:
          type: oauth2
          flows:
            implicit:
              authorizationUrl: ${authorizationUrl}
              scopes:
                read: Read records
  `;
}

/**
 * Builds an operation using a security scheme named like a prototype setter.
 *
 * OpenAPI names are JSON data keys, so `__proto__` must retain the authored
 * scheme definition without mutating the collector object's prototype.
 */
function prototypeSecurityDocument(header: string): string {
  return dedent`
    openapi: 3.1.0
    info:
      title: Prototype-shaped security
      version: 1.0.0
    security:
      - __proto__: []
    paths:
      /prototype-security:
        get:
          responses:
            "200":
              description: OK
    components:
      securitySchemes:
        __proto__:
          type: apiKey
          in: header
          name: ${header}
  `;
}

/**
 * Builds equivalent reordered security sets or a changed scope membership.
 *
 * The reversed form changes alternative, scheme, and scope order together so
 * one comparison covers every set-like security collection.
 */
function securityOrderDocument(reverse: boolean, changed: boolean): string {
  const combined: Record<string, string[]> = Object.fromEntries(
    reverse
      ? [
          ["key", []],
          ["oauth", changed ? ["write", "admin"] : ["write", "read"]],
        ]
      : [
          ["oauth", ["read", "write"]],
          ["key", []],
        ],
  );
  return JSON.stringify({
    openapi: "3.1.0",
    info: { title: "Security ordering", version: "1.0.0" },
    security: reverse ? [{ backup: [] }, combined] : [combined, { backup: [] }],
    paths: {
      "/ordered-security": {
        get: { responses: { 200: { description: "OK" } } },
      },
    },
    components: {
      securitySchemes: {
        oauth: {
          type: "oauth2",
          flows: {
            implicit: {
              authorizationUrl: "https://identity.example/authorize",
              scopes: {
                read: "Read records",
                write: "Write records",
                admin: "Administer records",
              },
            },
          },
        },
        key: { type: "apiKey", in: "header", name: "X-Key" },
        backup: { type: "http", scheme: "bearer" },
      },
    },
  });
}

/**
 * Builds one OpenAPI document with selectable server preference order.
 *
 * The server values stay fixed while their array positions change, isolating
 * the ordered server-list contract from unrelated operation content.
 */
function serverOrderDocument(reverse: boolean): string {
  const servers: Array<Record<string, string>> = [
    { url: "https://first.example" },
    { url: "https://second.example" },
  ];
  if (reverse) servers.reverse();
  return JSON.stringify({
    openapi: "3.1.0",
    info: { title: "Server ordering", version: "1.0.0" },
    servers,
    paths: {
      "/ordered-servers": {
        get: { responses: { 200: { description: "OK" } } },
      },
    },
  });
}

/**
 * Builds semantically equivalent reordered Swagger 2.0 security requirements.
 *
 * The fixture exercises normalization after conversion to OpenAPI so legacy
 * documents receive the same set-like security treatment as native input.
 */
function swaggerTwoSecurityOrderDocument(reverse: boolean): string {
  return JSON.stringify({
    swagger: "2.0",
    info: { title: "Legacy security ordering", version: "1.0.0" },
    security: reverse
      ? [{ key: [] }, { oauth: ["write", "read"] }]
      : [{ oauth: ["read", "write"] }, { key: [] }],
    paths: {
      "/legacy-security": {
        get: { responses: { 200: { description: "OK" } } },
      },
    },
    securityDefinitions: {
      oauth: {
        type: "oauth2",
        flow: "implicit",
        authorizationUrl: "https://identity.example/authorize",
        scopes: { read: "Read records", write: "Write records" },
      },
      key: { type: "apiKey", in: "header", name: "X-Key" },
    },
  });
}

/**
 * Builds a Swagger 2.0 operation for conversion-boundary fingerprint checks.
 *
 * Host and API-key header inputs mutate server and security meaning before the
 * loader upgrades the document to the shared OpenAPI representation.
 */
function swaggerTwoDocument(host: string, header: string): string {
  return dedent`
    swagger: "2.0"
    info:
      title: Legacy
      version: 1.0.0
    schemes: [https]
    host: ${host}
    basePath: /api
    security:
      - key: []
    paths:
      /legacy:
        get:
          responses:
            "200":
              description: OK
    securityDefinitions:
      key:
        type: apiKey
        in: header
        name: ${header}
  `;
}
