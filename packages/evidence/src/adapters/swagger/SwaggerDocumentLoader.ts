import type { OpenApi } from "@typia/interface";
import { OpenApiConverter } from "@typia/utils";
import typia from "typia";
import {
  isAlias,
  isMap,
  isNode,
  isScalar,
  parseDocument,
  type Document,
  type Node,
  type ParsedNode,
} from "yaml";

import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import { CanonicalJson } from "../../internal/CanonicalJson";
import type { ISwaggerCacheEntry } from "./ISwaggerCacheEntry";
import type { ISwaggerLoadResult } from "./ISwaggerLoadResult";
import type { ISwaggerOperation } from "./ISwaggerOperation";
import type { ISwaggerOperationLocation } from "./ISwaggerOperationLocation";
import type { IYamlScalarMapping } from "./IYamlScalarMapping";
import { SourceText } from "../../internal/SourceText";
import { SwaggerDescription } from "./SwaggerDescription";
import type { SwaggerDocumentInput } from "./SwaggerDocumentInput";
import { YamlScalarMapper } from "./YamlScalarMapper";

const CACHE_LIMIT = 16;
const COMPONENT_REFERENCE_PREFIX = "#/components/";
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const METHODS: OpenApi.Method[] = [
  "get",
  "post",
  "put",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
  "query",
];
const cache = new Map<string, ISwaggerCacheEntry>();

/** Normalizes Swagger/OpenAPI documents and fingerprints their operations. */
export namespace SwaggerDocumentLoader {
  export async function load(
    source: IEvidenceSourceFile,
  ): Promise<ISwaggerLoadResult> {
    if (Buffer.byteLength(source.content) > MAX_DOCUMENT_BYTES)
      throw new Error(
        `The Swagger document exceeds the ${MAX_DOCUMENT_BYTES} byte limit.`,
      );
    const remembered = cache.get(source.digest);
    if (remembered?.result !== undefined)
      return structuredClone(remembered.result);
    if (remembered?.problem !== undefined) throw new Error(remembered.problem);
    try {
      const yaml = parseDocument(source.content, { keepSourceTokens: true });
      if (yaml.errors.length !== 0)
        throw new Error(yaml.errors.map((error) => error.message).join("\n"));
      const input: unknown = yaml.toJS({ maxAliasCount: 100 });
      const document: OpenApi.IDocument = OpenApiConverter.upgradeDocument(
        typia.assert<SwaggerDocumentInput>(input),
      );
      const result: ISwaggerLoadResult = {
        operations: operations(source.content, yaml, document),
      };
      remember(source.digest, { result });
      return structuredClone(result);
    } catch (cause) {
      const problem = message(cause);
      remember(source.digest, { problem });
      throw new Error(problem);
    }
  }
}

function operations(
  content: string,
  yaml: Document.Parsed<ParsedNode>,
  document: OpenApi.IDocument,
): ISwaggerOperation[] {
  const output: ISwaggerOperation[] = [];
  for (const [operationPath, item] of Object.entries(document.paths ?? {})) {
    for (const method of METHODS) {
      const operation = item[method];
      if (operation !== undefined)
        output.push(
          operationOf(
            content,
            yaml,
            method,
            operationPath,
            operation,
            document.components,
          ),
        );
    }
    for (const [method, operation] of Object.entries(
      item.additionalOperations ?? {},
    ))
      output.push(
        operationOf(
          content,
          yaml,
          method,
          operationPath,
          operation,
          document.components,
        ),
      );
  }
  output.sort((x, y) => compare(x.target, y.target));
  for (let index = 1; index < output.length; ++index) {
    const previous = output[index - 1];
    const current = output[index];
    if (previous !== undefined && current?.target === previous.target)
      throw new Error(
        `OpenAPI operation '${current.method} ${current.path}' is declared more than once.`,
      );
  }
  return output;
}

function operationOf(
  content: string,
  yaml: Document.Parsed<ParsedNode>,
  method: string,
  operationPath: string,
  operation: OpenApi.IOperation,
  components: OpenApi.IComponents,
): ISwaggerOperation {
  if (!operationPath.startsWith("/") || /\s/u.test(operationPath))
    throw new Error(
      `OpenAPI path '${operationPath}' cannot form a whitespace-free operation target.`,
    );
  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u.test(method) || method.includes(":"))
    throw new Error(
      `OpenAPI method '${method}' cannot form a METHOD:/path target.`,
    );
  const normalizedMethod = method.toUpperCase();
  const target = `${normalizedMethod}:${operationPath}`;
  const position = location(
    content,
    yaml,
    operationPath,
    method,
    operation.description,
  );
  return {
    method: normalizedMethod,
    path: operationPath,
    target,
    digest: CanonicalJson.digest(
      withResolvedReferences(semanticOperation(operation), components),
    ),
    ...(operation.description === undefined
      ? {}
      : { description: operation.description }),
    ...(position === undefined ? {} : { location: position }),
  };
}

function semanticOperation(operation: OpenApi.IOperation): object {
  const output = CanonicalJson.without(operation, ["description"]);
  if (operation.description !== undefined) {
    const description = SwaggerDescription.semantic(operation.description);
    if (description !== "") output["description"] = description;
  }
  return output;
}

function location(
  content: string,
  yaml: Document.Parsed<ParsedNode>,
  operationPath: string,
  method: string,
  description: string | undefined,
): ISwaggerOperationLocation | undefined {
  const paths = operationPaths(operationPath, method);
  const node = firstNode(yaml, paths);
  const descriptionNode = descriptionSource(yaml, paths);
  const source = new SourceText(content);
  const tuple = node?.range ?? descriptionNode?.range;
  if (tuple === undefined || tuple === null) return undefined;
  let mapping: IYamlScalarMapping | undefined;
  if (description !== undefined) {
    const scalar = isScalar<string>(descriptionNode)
      ? descriptionNode
      : isAlias(descriptionNode)
        ? descriptionNode.resolve(yaml)
        : undefined;
    if (isScalar<string>(scalar) && typeof scalar.value === "string")
      mapping = YamlScalarMapper.map(content, scalar);
  }
  return {
    range: source.range(tuple[0], tuple[1]),
    ...(mapping === undefined ? {} : { description: mapping }),
  };
}

function descriptionSource(
  yaml: Document.Parsed<ParsedNode>,
  paths: unknown[][],
): Node | undefined {
  const direct = firstNode(
    yaml,
    paths.map((segments) => [...segments, "description"]),
  );
  if (direct !== undefined) return direct;
  for (const path of paths) {
    const operation: unknown = yaml.getIn(path, true);
    if (!isAlias(operation)) continue;
    const resolved = operation.resolve(yaml);
    if (!isMap(resolved)) continue;
    const description: unknown = resolved.get("description", true);
    if (isNode(description)) return description;
  }
  return undefined;
}

function operationPaths(operationPath: string, method: string): unknown[][] {
  const methods = Array.from(
    new Set([method, method.toLowerCase(), method.toUpperCase()]),
  );
  return [
    ...methods.map((name) => ["paths", operationPath, name]),
    ...["additionalOperations", "x-additionalOperations"].flatMap((container) =>
      methods.map((name) => ["paths", operationPath, container, name]),
    ),
  ];
}

function firstNode(
  yaml: Document.Parsed<ParsedNode>,
  paths: unknown[][],
): Node | undefined {
  for (const path of paths) {
    const value: unknown = yaml.getIn(path, true);
    if (isNode(value)) return value;
  }
  return undefined;
}

function withResolvedReferences(
  value: unknown,
  components: object,
  open: Set<string> = new Set<string>(),
): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const elements: unknown[] = value;
    return elements.map((element) =>
      withResolvedReferences(element, components, open),
    );
  }
  const entries: Array<[string, unknown]> = Object.entries(value);
  const reference: unknown = Reflect.get(value, "$ref");
  if (typeof reference !== "string" || open.has(reference))
    return resolveEntries(entries, components, open);
  const target = componentAt(components, reference);
  if (target === undefined) return resolveEntries(entries, components, open);
  open.add(reference);
  try {
    const resolved = withResolvedReferences(target, components, open);
    const siblings: Array<[string, unknown]> = [];
    for (const [key, element] of entries)
      if (key !== "$ref")
        siblings.push([key, withResolvedReferences(element, components, open)]);
    if (siblings.length === 0) return resolved;
    if (resolved === null || typeof resolved !== "object")
      return Object.fromEntries(siblings);
    return Object.assign({}, resolved, Object.fromEntries(siblings));
  } finally {
    open.delete(reference);
  }
}

function resolveEntries(
  entries: Array<[string, unknown]>,
  components: object,
  open: Set<string>,
): object {
  return Object.fromEntries(
    entries.map(([key, element]) => [
      key,
      withResolvedReferences(element, components, open),
    ]),
  );
}

function componentAt(components: object, reference: string): unknown {
  if (!reference.startsWith(COMPONENT_REFERENCE_PREFIX)) return undefined;
  const segments = reference
    .slice(COMPONENT_REFERENCE_PREFIX.length)
    .split("/")
    .map((segment) =>
      decodeURIComponent(segment).replaceAll("~1", "/").replaceAll("~0", "~"),
    );
  let current: unknown = components;
  for (const segment of segments) {
    if (
      current === null ||
      typeof current !== "object" ||
      Array.isArray(current) ||
      !Reflect.has(current, segment)
    )
      return undefined;
    current = Reflect.get(current, segment);
  }
  return current;
}

function remember(key: string, entry: ISwaggerCacheEntry): void {
  if (cache.has(key)) return;
  while (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, structuredClone(entry));
}

function compare(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
