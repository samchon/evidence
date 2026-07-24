import type { OpenApi } from "@typia/interface";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

import { normalizeSwaggerDocument } from "./normalizeSwaggerDocument";

const MAX_DOCUMENT_BYTES: number = 16 * 1024 * 1024;
const REMOTE_TIMEOUT_MILLISECONDS: number = 30_000;
const METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
  "query",
] as const satisfies readonly OpenApi.Method[];

interface ISwaggerDocumentInventory {
  source: string;
  operations: ISwaggerOperation[];
}

interface ISwaggerDocumentProblem {
  source: string;
  message: string;
}

interface ISwaggerOperation {
  method: string;
  path: string;
}

/**
 * Loads and normalizes every configured Swagger source for the native rule.
 *
 * The native contributor is Go, while the version converter is JavaScript. This
 * function is the narrow process boundary between them: it accepts only source
 * locations and returns only operation identities.
 *
 * @internal
 */
export const loadSwaggerOperations = async (request: {
  root: string;
  sources: string[];
}) => {
  const loaded: Array<ISwaggerDocumentInventory | ISwaggerDocumentProblem> =
    await Promise.all(
      request.sources.map(async (source) => {
        try {
          const text: string = await readSource(request.root, source);
          const input: unknown = parse(text);
          const document: OpenApi.IDocument = normalizeSwaggerDocument(input);
          return {
            source,
            operations: operationsOf(document),
          } satisfies ISwaggerDocumentInventory;
        } catch (error) {
          return {
            source,
            message: errorMessage(error),
          } satisfies ISwaggerDocumentProblem;
        }
      }),
    );
  return {
    documents: loaded.filter(isInventory),
    problems: loaded.filter(isProblem),
  };
};

const readSource = async (root: string, source: string): Promise<string> => {
  if (source.startsWith("http://") || source.startsWith("https://"))
    return readRemoteSource(source);
  if (source.includes("://"))
    throw new Error("only http: and https: URLs are supported");
  if (path.isAbsolute(source))
    throw new Error("local Swagger paths must be project-relative");

  const location: string = path.resolve(root, source);
  const relative: string = path.relative(root, location);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error("local Swagger paths must stay below the project root");

  const stat: Awaited<ReturnType<typeof fs.stat>> = await fs.stat(location);
  if (!stat.isFile()) throw new Error("the local Swagger source is not a file");
  if (stat.size > MAX_DOCUMENT_BYTES)
    throw new Error(
      `the Swagger document exceeds the ${MAX_DOCUMENT_BYTES} byte limit`,
    );
  return decodeUtf8(await fs.readFile(location));
};

const readRemoteSource = async (source: string): Promise<string> => {
  const response: Response = await fetch(source, {
    signal: AbortSignal.timeout(REMOTE_TIMEOUT_MILLISECONDS),
  });
  if (!response.ok)
    throw new Error(
      `HTTP ${response.status} ${response.statusText || "response"}`,
    );
  if (response.body === null) return "";

  const reader: ReadableStreamDefaultReader<Uint8Array> =
    response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length: number = 0;
  while (true) {
    const next: ReadableStreamReadResult<Uint8Array> = await reader.read();
    if (next.done) break;
    length += next.value.byteLength;
    if (length > MAX_DOCUMENT_BYTES) {
      await reader.cancel();
      throw new Error(
        `the Swagger document exceeds the ${MAX_DOCUMENT_BYTES} byte limit`,
      );
    }
    chunks.push(next.value);
  }
  const content: Uint8Array = new Uint8Array(length);
  let offset: number = 0;
  for (const chunk of chunks) {
    content.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return decodeUtf8(content);
};

const decodeUtf8 = (content: Uint8Array): string =>
  new TextDecoder("utf-8", { fatal: true }).decode(content);

const operationsOf = (document: OpenApi.IDocument): ISwaggerOperation[] => {
  const operations: ISwaggerOperation[] = [];
  for (const [operationPath, item] of Object.entries(document.paths ?? {})) {
    for (const method of METHODS) {
      const operation: OpenApi.IOperation | undefined = item[method];
      if (operation !== undefined)
        operations.push(operationOf(method, operationPath));
    }
    for (const method of Object.keys(item.additionalOperations ?? {}))
      operations.push(operationOf(method, operationPath));
  }
  operations.sort((left, right) => {
    const leftTarget: string = `${left.method}:${left.path}`;
    const rightTarget: string = `${right.method}:${right.path}`;
    return leftTarget.localeCompare(rightTarget);
  });
  for (let index: number = 1; index < operations.length; index++) {
    const previous: ISwaggerOperation = operations[index - 1]!;
    const current: ISwaggerOperation = operations[index]!;
    if (
      `${previous.method}:${previous.path}` ===
      `${current.method}:${current.path}`
    )
      throw new Error(
        `OpenAPI operation '${current.method} ${current.path}' is declared more than once`,
      );
  }
  return operations;
};

const operationOf = (
  method: string,
  operationPath: string,
): ISwaggerOperation => {
  if (!operationPath.startsWith("/"))
    throw new Error(
      `OpenAPI path '${operationPath}' must start with '/' to form an operation target`,
    );
  if (
    /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u.test(method) === false ||
    method.includes(":")
  )
    throw new Error(
      `OpenAPI method '${method}' cannot form a '<METHOD>:<path>' target`,
    );
  return {
    method: method.toUpperCase(),
    path: operationPath,
  };
};

const isInventory = (
  value: ISwaggerDocumentInventory | ISwaggerDocumentProblem,
): value is ISwaggerDocumentInventory => "operations" in value;

const isProblem = (
  value: ISwaggerDocumentInventory | ISwaggerDocumentProblem,
): value is ISwaggerDocumentProblem => "message" in value;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
