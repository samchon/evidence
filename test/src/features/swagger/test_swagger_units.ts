import { EvidenceSwaggerAdapter } from "@wrtnlabs/evidence";
import type { IEvidenceInventory } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { TestFileSystem } from "../../internal/TestFileSystem";

/** Normalizes local Swagger 2.0 and OpenAPI 3.x documents into exact operations. */
export async function test_swagger_units(): Promise<void> {
  const location = join(__dirname, "units-" + randomUUID());
  await TestFileSystem.experiment(
    location,
    {
      "swagger.json": dedent`
        {
          "swagger": "2.0",
          "info": { "title": "Members", "version": "1.0.0" },
          "paths": {
            "/members": {
              "post": {
                "description": "Creates a member.",
                "responses": { "200": { "description": "OK" } }
              },
              "x-additionalOperations": {
                "link": {
                  "responses": { "200": { "description": "Linked" } }
                }
              }
            },
            "/Members/{id}/": {
              "get": {
                "responses": { "200": { "description": "OK" } }
              }
            }
          }
        }
      `,
      "openapi.yaml": dedent`
        openapi: 3.1.0
        info:
          title: Members
          version: 1.0.0
        paths:
          /members:
            post:
              description: Creates a member.
              responses:
                "200":
                  description: OK
            x-additionalOperations:
              link:
                responses:
                  "200":
                    description: Linked
          /Members/{id}/:
            get:
              responses:
                "200":
                  description: OK
        webhooks:
          member.created:
            post:
              responses:
                "200":
                  description: Ignored
      `,
      "openapi30.json": dedent`
        {
          "openapi": "3.0.3",
          "info": { "title": "Legacy", "version": "1.0.0" },
          "paths": {
            "/legacy": {
              "get": {
                "responses": { "200": { "description": "OK" } }
              }
            }
          }
        }
      `,
      "openapi32.yaml": dedent`
        openapi: 3.2.0
        info:
          title: Search
          version: 1.0.0
        paths:
          /search:
            query:
              responses:
                "200":
                  description: Found
      `,
    },
    async (directory) => {
      const config = join(directory, "evidence.config.ts");
      const adapter = new EvidenceSwaggerAdapter();
      const swagger = await adapter.load(config, "swagger.json");
      const openapi = await adapter.load(config, "openapi.yaml");
      const openapi30 = await adapter.load(config, "openapi30.json");
      const openapi32 = await adapter.load(config, "openapi32.yaml");

      TestValidator.equals("Swagger 2.0 operations", targets(swagger), [
        "GET:/Members/{id}/",
        "LINK:/members",
        "POST:/members",
      ]);
      TestValidator.equals("OpenAPI YAML operations", targets(openapi), [
        "GET:/Members/{id}/",
        "LINK:/members",
        "POST:/members",
      ]);
      TestValidator.equals("OpenAPI 3.0 operation", targets(openapi30), [
        "GET:/legacy",
      ]);
      TestValidator.equals("OpenAPI 3.2 query operation", targets(openapi32), [
        "QUERY:/search",
      ]);
      TestValidator.predicate("Swagger document is complete", swagger.complete);
      TestValidator.predicate("OpenAPI document is complete", openapi.complete);

      // Equal operation targets in independent documents retain distinct semantic IDs.
      TestValidator.notEquals(
        "document-scoped operation identity",
        swagger.units.find((unit) => unit.name === "POST:/members")?.id,
        openapi.units.find((unit) => unit.name === "POST:/members")?.id,
      );
      TestValidator.equals(
        "operations have no invented aggregate",
        swagger.units.some((unit) => unit.symbol !== "operation"),
        false,
      );
    },
  );
}

function targets(inventory: IEvidenceInventory): string[] {
  return inventory.units.map((unit) => unit.name);
}
