import { EvidSwaggerAdapter } from "evid";
import type { IEvidDeclaration, IEvidHost, IEvidInventory } from "evid";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidTestSourceSnapshot } from "../../internal/EvidTestSourceSnapshot";

/**
 * Parses annotation tags from supported Swagger operation descriptions.
 *
 * Descriptions on unrelated document nodes cannot acknowledge an operation,
 * even when their text contains a tag.
 *
 * 1. Analyze eligible and ineligible descriptions.
 * 2. Verify extracted targets, coordinates, and host diagnostics.
 */
export async function test_swagger_hosts(): Promise<void> {
  const inventory = await new EvidSwaggerAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "openapi.yaml",
      dedent`
        openapi: 3.1.0
        info:
          title: Members
          version: 1.0.0
        paths:
          /members:
            post:
              description: |-
                Creates a member.

                \`\`\`
                @evidence docs/spec.md#fenced This is an example.
                \`\`\`

                @evidence docs/spec.md#members Implements member creation.
                @evidenceReview docs/spec.md#members #abcdef0 Read the requirement.
                @evidenceExclude docs/spec.md#legacy The legacy route is intentionally absent.
                @evidenceExcludeReview docs/spec.md#legacy #1234567 Checked the removal.
              responses:
                "200":
                  description: "@evidence docs/spec.md#response This is not an operation host."
          /health:
            get:
              responses:
                "200":
                  description: Healthy
        components:
          schemas:
            Member:
              description: "@evidence docs/spec.md#component This is not an operation host."
              type: object
      `.replaceAll("\n", "\r\n"),
    ),
  );

  TestValidator.equals(
    "operation description declarations",
    inventory.declarations.map((entry) => [entry.kind, entry.target]),
    [
      ["evidence", "docs/spec.md#members"],
      ["evidenceExclude", "docs/spec.md#legacy"],
    ],
  );
  TestValidator.equals(
    "operation description reviews",
    inventory.reviews.map((entry) => [entry.reviews, entry.target]),
    [
      ["evidence", "docs/spec.md#members"],
      ["evidenceExclude", "docs/spec.md#legacy"],
    ],
  );

  // Every operation remains an eligible attached host, even without a description.
  TestValidator.equals(
    "operation host populations",
    inventory.hosts.map((host) => [host.attachment, host.unitIds.length]),
    [
      ["attached", 1],
      ["attached", 1],
    ],
  );
  TestValidator.equals(
    "claim source line",
    line(requireDeclaration(inventory, "docs/spec.md#members")),
    15,
  );
  TestValidator.equals(
    "claim attaches to POST operation",
    requireHost(
      inventory,
      requireDeclaration(inventory, "docs/spec.md#members"),
    ).unitIds.map((id) => inventory.units.find((unit) => unit.id === id)?.name),
    ["POST:/members"],
  );
  TestValidator.equals("Swagger host diagnostics", inventory.diagnostics, []);

  // YAML aliases retain the physical anchor location that owns their decoded text.
  const aliased = await new EvidSwaggerAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "aliased.yaml",
      dedent`
        openapi: 3.1.0
        info:
          title: Aliased
          version: 1.0.0
        x-operation: &operation
          description: |-
            Shared operation prose.
            @evidence docs/spec.md#alias Applies the shared contract.
          responses:
            "200":
              description: OK
        paths:
          /alias:
            get: *operation
      `,
    ),
  );
  const alias = requireDeclaration(aliased, "docs/spec.md#alias");
  TestValidator.equals("aliased description source line", line(alias), 8);
  TestValidator.equals(
    "aliased declaration source text",
    declarationText(aliased, alias).startsWith("@evidence"),
    true,
  );

  // One Unicode escape may decode to two UTF-16 units before a later annotation.
  const escaped = await new EvidSwaggerAdapter().analyze(
    EvidTestSourceSnapshot.create(
      "escaped.yaml",
      dedent`
        openapi: 3.1.0
        info:
          title: Escaped
          version: 1.0.0
        paths:
          /escaped:
            get:
              description: "\\U0001F600\\n@evidence docs/spec.md#escaped Maps the source token."
              responses:
                "200":
                  description: OK
      `,
    ),
  );
  const unicode = requireDeclaration(escaped, "docs/spec.md#escaped");
  TestValidator.equals(
    "escaped declaration source text",
    declarationText(escaped, unicode).startsWith("@evidence"),
    true,
  );
}

function requireDeclaration(
  inventory: IEvidInventory,
  target: string,
): IEvidDeclaration {
  const declaration = inventory.declarations.find(
    (candidate) => candidate.target === target,
  );
  if (declaration === undefined)
    throw new Error(`Missing Swagger declaration: ${target}`);
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
    throw new Error(`Missing Swagger host: ${declaration.hostId}`);
  return host;
}

function line(declaration: IEvidDeclaration): number {
  const range = declaration.location.range;
  if (range === undefined)
    throw new Error(`Missing Swagger declaration range: ${declaration.target}`);
  return range.start.line;
}

function declarationText(
  inventory: IEvidInventory,
  declaration: IEvidDeclaration,
): string {
  const source = inventory.sources.find(
    (candidate) => candidate.physicalPath === declaration.location.file,
  );
  const range = declaration.location.range;
  if (source === undefined || range === undefined)
    throw new Error(
      `Missing Swagger declaration source: ${declaration.target}`,
    );
  return source.content.slice(range.start.offset, range.end.offset);
}
