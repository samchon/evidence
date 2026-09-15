import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

import typia from "typia";

import { EvidCanonicalJson } from "../../internal/EvidCanonicalJson";
import type { IEvidPrismaCacheEntry } from "./IEvidPrismaCacheEntry";
import type { IEvidPrismaDatamodel } from "./IEvidPrismaDatamodel";
import type { IEvidPrismaDatamodelModel } from "./IEvidPrismaDatamodelModel";
import type { IEvidPrismaLoadResult } from "./IEvidPrismaLoadResult";
import type { IEvidPrismaModel } from "./IEvidPrismaModel";
import type { IEvidPrismaParser } from "./IEvidPrismaParser";
import type { IEvidPrismaSchemaFile } from "./IEvidPrismaSchemaFile";

const ANSI_PATTERN = /\x1b\[[0-9;]*m/gu;
const CACHE_LIMIT = 16;
const cache = new Map<string, IEvidPrismaCacheEntry>();

/**
 * Loads Prisma's resolved schema model through a consumer-compatible WASM bridge.
 *
 * The loader resolves the parser from the consumer first, caches complete
 * schema-set outcomes by parser identity and content digest, and returns detached
 * records that can outlive the WASM call.
 */
export namespace EvidPrismaModelLoader {
  export async function load(
    root: string,
    files: IEvidPrismaSchemaFile[],
  ): Promise<IEvidPrismaLoadResult> {
    const parser = resolve(root);
    const digest = schemaDigest(files);
    const key = `${parser.origin}\0${parser.version}\0${digest}`;
    const remembered = cache.get(key);
    if (remembered !== undefined && remembered.models !== undefined)
      return { models: structuredClone(remembered.models), digest };
    if (remembered !== undefined && remembered.problem !== undefined)
      throw new Error(remembered.problem);
    let payload: string;
    try {
      payload = parser.getDatamodel(
        JSON.stringify({
          prismaSchema: files.map((file) => [file.name, file.source.content]),
        }),
      );
    } catch (cause) {
      const problem = `${failure(cause)} (parsed by @prisma/prisma-schema-wasm@${parser.version} resolved from the ${parser.origin})`;
      remember(key, { problem });
      throw new Error(problem);
    }
    let datamodel: IEvidPrismaDatamodel;
    try {
      datamodel = typia.json.assertParse<IEvidPrismaDatamodel>(payload);
    } catch (cause) {
      throw new Error(
        `The Prisma parser returned an incompatible datamodel payload: ${message(cause)}`,
      );
    }
    const models = datamodel.models.map(model);
    remember(key, { models });
    return { models: structuredClone(models), digest };
  }

  function model(input: IEvidPrismaDatamodelModel): IEvidPrismaModel {
    return {
      name: input.name,
      documentation: input.documentation ?? "",
      digest: EvidCanonicalJson.digest(
        EvidCanonicalJson.without(input, ["documentation", "fields"]),
      ),
      fields: input.fields.map((field) => ({
        name: field.name,
        symbol: field.kind === "object" ? "relation" : "column",
        documentation: field.documentation ?? "",
        digest: EvidCanonicalJson.digest(
          EvidCanonicalJson.without(field, ["documentation"]),
        ),
      })),
    };
  }

  function resolve(root: string): IEvidPrismaParser {
    const failures: string[] = [];
    for (const origin of ["project", "package"]) {
      try {
        const resolver =
          origin === "project"
            ? createRequire(path.join(root, "package.json"))
            : createRequire(__filename);
        const manifest: unknown = resolver(
          "@prisma/prisma-schema-wasm/package.json",
        );
        const module: unknown = resolver("@prisma/prisma-schema-wasm");
        if (
          typeof module !== "object" ||
          module === null ||
          !("get_datamodel" in module) ||
          typeof module.get_datamodel !== "function"
        )
          throw new Error("the module exposes no get_datamodel function");
        const getDatamodel = module.get_datamodel;
        return {
          getDatamodel(parameters: string): string {
            const output: unknown = getDatamodel(parameters);
            if (typeof output !== "string")
              throw new Error("the parser returned a non-string payload");
            return output;
          },
          version: version(manifest),
          origin,
        };
      } catch (cause) {
        failures.push(`${origin}: ${message(cause)}`);
      }
    }
    throw new Error(
      `No Prisma schema parser could be resolved (${failures.join("; ")}).`,
    );
  }

  function version(manifest: unknown): string {
    if (
      typeof manifest === "object" &&
      manifest !== null &&
      "version" in manifest &&
      typeof manifest.version === "string"
    )
      return manifest.version;
    return "unknown";
  }

  function schemaDigest(files: IEvidPrismaSchemaFile[]): string {
    const hash = createHash("sha256");
    for (const file of files) {
      hash.update(file.name);
      hash.update("\0");
      hash.update(file.source.digest);
      hash.update("\n");
    }
    return hash.digest("hex");
  }

  function remember(key: string, entry: IEvidPrismaCacheEntry): void {
    if (cache.has(key)) return;
    while (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
    cache.set(key, structuredClone(entry));
  }

  function failure(cause: unknown): string {
    const raw = message(cause);
    try {
      const envelope: unknown = JSON.parse(raw);
      if (
        typeof envelope === "object" &&
        envelope !== null &&
        "message" in envelope &&
        typeof envelope.message === "string"
      )
        return envelope.message.replace(ANSI_PATTERN, "").trim();
    } catch {
      // A non-JSON error already is the complete parser message.
    }
    return raw.replace(ANSI_PATTERN, "").trim();
  }

  function message(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
  }
}
