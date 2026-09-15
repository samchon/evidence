import type { OpenApi } from "@typia/interface";
import { OpenApiConverter } from "@typia/utils";
import typia from "typia";
import {
  isAlias,
  isMap,
  isNode,
  isScalar,
  parseDocument,
  type Document as EvidenceYamlDocument,
  type Node as EvidenceYamlNode,
  type ParsedNode as EvidenceYamlParsedNode,
} from "yaml";

import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import { EvidenceCanonicalJson } from "../../internal/EvidenceCanonicalJson";
import type { IEvidenceSwaggerCacheEntry } from "./IEvidenceSwaggerCacheEntry";
import type { IEvidenceSwaggerLoadResult } from "./IEvidenceSwaggerLoadResult";
import type { IEvidenceSwaggerOperation } from "./IEvidenceSwaggerOperation";
import type { IEvidenceSwaggerOperationLocation } from "./IEvidenceSwaggerOperationLocation";
import type { IEvidenceYamlScalarMapping } from "./IEvidenceYamlScalarMapping";
import { EvidenceSourceText } from "../../internal/EvidenceSourceText";
import { EvidenceSwaggerDescription } from "./EvidenceSwaggerDescription";
import type { EvidenceSwaggerDocumentInput } from "./EvidenceSwaggerDocumentInput";
import { EvidenceYamlScalarMapper } from "./EvidenceYamlScalarMapper";

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
const cache = new Map<string, IEvidenceSwaggerCacheEntry>();

/**
 * Normalizes Swagger/OpenAPI documents and fingerprints their operations.
 *
 * This is the single version-conversion boundary: callers receive detached,
 * serializable records rather than parser nodes or mutable converter objects.
 */
export namespace EvidenceSwaggerDocumentLoader {
  /**
   * Loads one source snapshot with digest-keyed success and failure caching.
   *
   * Cache entries are cloned on both insertion and return so no caller can
   * mutate the shared semantic result used by another analysis.
   */
  export async function load(
    source: IEvidenceSourceFile,
  ): Promise<IEvidenceSwaggerLoadResult> {
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
        typia.assert<EvidenceSwaggerDocumentInput>(input),
      );
      const result: IEvidenceSwaggerLoadResult = {
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

/**
 * Materializes every operation with its inherited OpenAPI contract context.
 *
 * Server and security inheritance is resolved here while the path-item and
 * document scopes are still available. Passing only the operation object would
 * let a root policy change preserve an obsolete review fingerprint.
 */
function operations(
  content: string,
  yaml: EvidenceYamlDocument.Parsed<EvidenceYamlParsedNode>,
  document: OpenApi.IDocument,
): IEvidenceSwaggerOperation[] {
  const output: IEvidenceSwaggerOperation[] = [];
  // OpenAPI defines an absent or empty root server list as `/`. Normalize that
  // default before nested scopes choose whether to inherit or override it.
  const rootServers: OpenApi.IServer[] =
    document.servers === undefined || document.servers.length === 0
      ? [{ url: "/" }]
      : document.servers;
  const rootSecurity: Record<string, string[]>[] = document.security ?? [];
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
            operation.servers ?? item.servers ?? rootServers,
            operation.security ?? rootSecurity,
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
          operation.servers ?? item.servers ?? rootServers,
          operation.security ?? rootSecurity,
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

/**
 * Creates one target and digest after validating its public target spelling.
 *
 * Location remains tied to the authored YAML node, while the digest receives
 * the effective contract assembled across OpenAPI scopes and resolved component
 * references. Presentation-only description formatting is normalized later.
 */
function operationOf(
  content: string,
  yaml: EvidenceYamlDocument.Parsed<EvidenceYamlParsedNode>,
  method: string,
  operationPath: string,
  operation: OpenApi.IOperation,
  components: OpenApi.IComponents,
  servers: OpenApi.IServer[],
  security: Record<string, string[]>[],
): IEvidenceSwaggerOperation {
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
    digest: EvidenceCanonicalJson.digest(
      withResolvedReferences(
        semanticOperation(operation, components, servers, security),
        components,
      ),
    ),
    ...(operation.description === undefined
      ? {}
      : { description: operation.description }),
    ...(position === undefined ? {} : { location: position }),
  };
}

/**
 * Builds the semantic operation payload consumed by canonical hashing.
 *
 * Effective servers and security replace raw operation-level fields. Only
 * security schemes named by the effective requirements are included, so a used
 * authentication definition expires review while an unrelated component edit
 * leaves the operation stable.
 */
function semanticOperation(
  operation: OpenApi.IOperation,
  components: OpenApi.IComponents,
  servers: OpenApi.IServer[],
  security: Record<string, string[]>[],
): object {
  const output: Record<string, unknown> = EvidenceCanonicalJson.without(operation, [
    "description",
  ]);
  output["servers"] = servers;
  output["security"] = normalizedSecurity(security);
  // Scheme names are JSON keys. A null prototype keeps `__proto__` as data and
  // prevents inherited members from masquerading as authored definitions.
  const schemes: Record<string, OpenApi.ISecurityScheme> = Object.create(
    null,
  ) as Record<string, OpenApi.ISecurityScheme>;
  for (const requirement of security)
    for (const name of Object.keys(requirement)) {
      const catalog: Record<string, OpenApi.ISecurityScheme> | undefined =
        components.securitySchemes;
      const scheme: OpenApi.ISecurityScheme | undefined =
        catalog !== undefined && Object.hasOwn(catalog, name)
          ? catalog[name]
          : undefined;
      if (scheme !== undefined) schemes[name] = scheme;
    }
  if (Object.keys(schemes).length !== 0) output["securitySchemes"] = schemes;
  if (operation.description !== undefined) {
    const description: string = EvidenceSwaggerDescription.semantic(
      operation.description,
    );
    if (description !== "") output["description"] = description;
  }
  return output;
}

/**
 * Canonicalizes the set-like portions of an effective security contract.
 *
 * OpenAPI treats requirement objects as alternatives and every listed scheme
 * and scope as a conjunction. Sorting those members prevents presentation-only
 * reordering from expiring reviews while retaining duplicate alternatives.
 */
function normalizedSecurity(
  security: Record<string, string[]>[],
): Record<string, string[]>[] {
  const normalized: Record<string, string[]>[] = security.map(
    (requirement: Record<string, string[]>): Record<string, string[]> =>
      Object.fromEntries(
        Object.entries(requirement)
          .sort((left: [string, string[]], right: [string, string[]]): number =>
            compare(left[0], right[0]),
          )
          .map((entry: [string, string[]]): [string, string[]] => [
            entry[0],
            [...entry[1]].sort(compare),
          ]),
      ),
  );
  normalized.sort(
    (left: Record<string, string[]>, right: Record<string, string[]>): number =>
      compare(JSON.stringify(left), JSON.stringify(right)),
  );
  return normalized;
}

/**
 * Maps one converted operation back to its authored YAML source.
 *
 * Direct mappings and alias-backed descriptions both preserve the scalar map
 * needed for evidence tags; unavailable parser ranges leave location optional.
 */
function location(
  content: string,
  yaml: EvidenceYamlDocument.Parsed<EvidenceYamlParsedNode>,
  operationPath: string,
  method: string,
  description: string | undefined,
): IEvidenceSwaggerOperationLocation | undefined {
  const paths = operationPaths(operationPath, method);
  const node = firstNode(yaml, paths);
  const descriptionNode = descriptionSource(yaml, paths);
  const source = new EvidenceSourceText(content);
  const tuple = node?.range ?? descriptionNode?.range;
  if (tuple === undefined || tuple === null) return undefined;
  let mapping: IEvidenceYamlScalarMapping | undefined;
  if (description !== undefined) {
    const scalar = isScalar<string>(descriptionNode)
      ? descriptionNode
      : isAlias(descriptionNode)
        ? descriptionNode.resolve(yaml)
        : undefined;
    if (isScalar<string>(scalar) && typeof scalar.value === "string")
      mapping = EvidenceYamlScalarMapper.map(content, scalar);
  }
  return {
    range: source.range(tuple[0], tuple[1]),
    ...(mapping === undefined ? {} : { description: mapping }),
  };
}

/**
 * Finds the authored YAML node that supplied an operation description.
 *
 * A direct description wins. If the operation is a YAML alias, the resolved map
 * supplies the scalar whose source token still belongs to the original
 * document.
 */
function descriptionSource(
  yaml: EvidenceYamlDocument.Parsed<EvidenceYamlParsedNode>,
  paths: unknown[][],
): EvidenceYamlNode | undefined {
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

/**
 * Enumerates YAML lookup paths for one converted operation.
 *
 * Case variants and supported additional-operation containers account for the
 * shapes normalized by OpenApiConverter while retaining authored locations.
 */
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

/**
 * Returns the first YAML node found at a list of candidate paths.
 *
 * Candidate order expresses source-location precedence, and scalar values are
 * accepted because operation descriptions can be direct nodes.
 */
function firstNode(
  yaml: EvidenceYamlDocument.Parsed<EvidenceYamlParsedNode>,
  paths: unknown[][],
): EvidenceYamlNode | undefined {
  for (const path of paths) {
    const value: unknown = yaml.getIn(path, true);
    if (isNode(value)) return value;
  }
  return undefined;
}

/**
 * Expands local component references into the operation fingerprint payload.
 *
 * Sibling fields override the resolved component value. The active-reference
 * set terminates cycles, while unresolved references remain literal so edits to
 * their spelling still affect the digest.
 */
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
  const reference: unknown = Object.hasOwn(value, "$ref")
    ? Reflect.get(value, "$ref")
    : undefined;
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
    return Object.fromEntries([...Object.entries(resolved), ...siblings]);
  } finally {
    open.delete(reference);
  }
}

/**
 * Recursively resolves every value in one ordinary object entry list.
 *
 * Rebuilding through entries preserves authored own keys, including names that
 * would otherwise interact with an object's prototype.
 */
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

/**
 * Resolves one local OpenAPI component pointer through authored own properties.
 *
 * URI and JSON Pointer escapes are decoded per segment. Inherited properties
 * are excluded because only document-owned components may alter an operation
 * digest.
 */
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
      !Object.hasOwn(current, segment)
    )
      return undefined;
    current = Reflect.get(current, segment);
  }
  return current;
}

/**
 * Stores one detached load result in the bounded insertion-order cache.
 *
 * Existing digests remain stable entries; new values evict the oldest digest
 * and are cloned so later callers cannot mutate shared state.
 */
function remember(key: string, entry: IEvidenceSwaggerCacheEntry): void {
  if (cache.has(key)) return;
  while (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, structuredClone(entry));
}

/**
 * Orders operation targets by their exact portable spelling.
 *
 * Locale-independent comparison keeps duplicate detection deterministic across
 * machines and Node locales.
 */
function compare(x: string, y: string): number {
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Converts an unknown load failure into stable cached diagnostic text.
 *
 * Error instances retain their authored message; non-errors use JavaScript's
 * string conversion so every failure can cross the serializable cache
 * boundary.
 */
function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
