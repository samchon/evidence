import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

import typia from "typia";

import { EvidenceCanonicalJson } from "../../internal/EvidenceCanonicalJson";
import type { IEvidencePrismaCacheEntry } from "./IEvidencePrismaCacheEntry";
import type { IEvidencePrismaDatamodel } from "./IEvidencePrismaDatamodel";
import type { IEvidencePrismaDatamodelModel } from "./IEvidencePrismaDatamodelModel";
import type { IEvidencePrismaLoadResult } from "./IEvidencePrismaLoadResult";
import type { IEvidencePrismaModel } from "./IEvidencePrismaModel";
import type { IEvidencePrismaParser } from "./IEvidencePrismaParser";
import type { IEvidencePrismaSchemaFile } from "./IEvidencePrismaSchemaFile";

const ANSI_PATTERN = /\x1b\[[0-9;]*m/gu;
const CACHE_LIMIT = 16;
const cache = new Map<string, IEvidencePrismaCacheEntry>();

/**
 * Loads Prisma's resolved schema model through a consumer-compatible WASM
 * bridge.
 *
 * The loader resolves the parser from the consumer first, caches complete
 * schema-set outcomes by parser identity and content digest, and returns
 * detached records that can outlive the WASM call.
 */
export namespace EvidencePrismaModelLoader {
  export async function load(
    root: string,
    files: IEvidencePrismaSchemaFile[],
  ): Promise<IEvidencePrismaLoadResult> {
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
    let datamodel: IEvidencePrismaDatamodel;
    try {
      datamodel = typia.json.assertParse<IEvidencePrismaDatamodel>(payload);
    } catch (cause) {
      throw new Error(
        `The Prisma parser returned an incompatible datamodel payload: ${message(cause)}`,
      );
    }
    const models = datamodel.models.map(model);
    remember(key, { models });
    return { models: structuredClone(models), digest };
  }

  function model(input: IEvidencePrismaDatamodelModel): IEvidencePrismaModel {
    return {
      name: input.name,
      documentation: input.documentation ?? "",
      digest: EvidenceCanonicalJson.digest(
        EvidenceCanonicalJson.without(input, ["documentation", "fields"]),
      ),
      fields: input.fields.map((field) => ({
        name: field.name,
        symbol: field.kind === "object" ? "relation" : "column",
        documentation: field.documentation ?? "",
        digest: EvidenceCanonicalJson.digest(
          EvidenceCanonicalJson.without(field, ["documentation"]),
        ),
      })),
    };
  }

  function resolve(root: string): IEvidencePrismaParser {
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

  function schemaDigest(files: IEvidencePrismaSchemaFile[]): string {
    const hash = createHash("sha256");
    for (const file of files) {
      hash.update(file.name);
      hash.update("\0");
      hash.update(file.source.digest);
      hash.update("\n");
    }
    return hash.digest("hex");
  }

  function remember(key: string, entry: IEvidencePrismaCacheEntry): void {
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
