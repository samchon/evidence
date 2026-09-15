import { EvidenceSwaggerAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { join } from "node:path";

/**
 * Loads bounded remote Swagger snapshots through a controlled endpoint.
 *
 * HTTP failure and oversized responses must remain incomplete while valid
 * bounded snapshots produce a normal inventory.
 *
 * 1. Serve valid, failing, and oversized document responses.
 * 2. Analyze each remote source.
 * 3. Verify complete success only for the bounded valid response.
 */
export async function test_swagger_remote(): Promise<void> {
  let requests = 0;
  const server = createServer((request, response) => {
    if (request.url !== undefined && request.url.startsWith("/failure")) {
      response.statusCode = 503;
      response.statusMessage = "Unavailable";
      response.end("unavailable");
      return;
    }
    if (request.url !== undefined && request.url.startsWith("/large")) {
      response.setHeader("content-length", 16 * 1024 * 1024 + 1);
      response.end();
      return;
    }
    ++requests;
    response.setHeader("content-type", "application/yaml");
    response.end(document(requests === 1 ? "/first" : "/second"));
  });
  const origin = await listen(server);

  try {
    const adapter = new EvidenceSwaggerAdapter();
    const config = join(__dirname, "evidence.config.ts");
    const first = await adapter.load(
      config,
      `${origin}/schema?token=secret-token`,
    );
    const second = await adapter.load(
      config,
      `${origin}/schema?token=secret-token`,
    );

    TestValidator.equals(
      "remote source is requested for every load",
      requests,
      2,
    );
    TestValidator.equals(
      "first remote snapshot",
      first.units.map((unit) => unit.name),
      ["GET:/first"],
    );
    TestValidator.equals(
      "second remote snapshot",
      second.units.map((unit) => unit.name),
      ["GET:/second"],
    );
    TestValidator.equals(
      "remote source URL is sanitized",
      first.sources.map((source) => source.physicalPath),
      [`${origin}/schema?<redacted>`],
    );
    TestValidator.equals(
      "remote source secret is absent from inventory",
      JSON.stringify(first).includes("secret-token"),
      false,
    );

    const failure = await adapter.load(
      config,
      `${origin}/failure?token=secret-token`,
    );
    TestValidator.equals("HTTP failure is incomplete", failure.complete, false);
    TestValidator.predicate(
      "HTTP status is visible",
      failure.diagnostics.some((diagnostic) =>
        diagnostic.message.includes("HTTP 503 Unavailable"),
      ),
    );
    TestValidator.equals(
      "failure URL secret is redacted",
      JSON.stringify(failure).includes("secret-token"),
      false,
    );

    const oversized = await adapter.load(config, `${origin}/large`);
    TestValidator.equals(
      "declared oversized response is incomplete",
      oversized.complete,
      false,
    );
    TestValidator.predicate(
      "remote byte limit is visible",
      oversized.diagnostics.some((diagnostic) =>
        diagnostic.message.includes("16777216 byte limit"),
      ),
    );
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
}

async function listen(server: Server): Promise<string> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("The Swagger fixture server has no TCP address.");
  return `http://127.0.0.1:${address.port}`;
}

function document(operationPath: string): string {
  return dedent`
    openapi: 3.1.0
    info:
      title: Remote
      version: 1.0.0
    paths:
      ${operationPath}:
        get:
          responses:
            "200":
              description: Healthy
  `;
}
