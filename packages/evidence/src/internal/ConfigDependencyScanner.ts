import { readFile, realpath, stat } from "node:fs/promises";
import { createRequire, isBuiltin } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EvidenceParser } from "../parsers/EvidenceParser";
import type { EvidenceParseSession } from "../parsers/EvidenceParseSession";
import type { IEvidenceSourceDependency } from "../structures/IEvidenceSourceDependency";
import type { EvidenceProgrammingType } from "../typings/EvidenceProgrammingType";
import { EcmaScriptSyntax } from "../adapters/ecmascript/EcmaScriptSyntax";
import { SourcePath } from "./SourcePath";

/**
 * Finds static local and package-resolution dependencies of one evaluated config.
 *
 * It records dependencies before reads and resolution complete, allowing watch
 * mode to observe a repaired import rather than remaining stuck on a failed scan.
 */
export class ConfigDependencyScanner {
  private readonly dependencies = new Map<string, IEvidenceSourceDependency>();
  private readonly scanned = new Set<string>();
  private readonly parser = new EvidenceParser({ concurrency: 1 });

  /** Creates a dependency scanner for one configuration entry file.
   *
   * The scanner owns a private parser and closes it after `scan` completes, so callers receive only serializable watch dependencies.
   */
  public constructor(private readonly configFile: string) {}

  /** Scans the configuration and every statically reachable local module.
   *
   * Parser resources close on both success and failure, while already discovered dependencies remain available through `list` for watch recovery.
   */
  public async scan(): Promise<IEvidenceSourceDependency[]> {
    try {
      if (programmingType(this.configFile) !== undefined)
        await this.watchModuleScope(path.resolve(this.configFile));
      await this.scanFile(path.resolve(this.configFile));
      return this.list();
    } finally {
      await this.parser.close();
    }
  }

  /** Returns ordered dependencies discovered before a failed read or parse.
   *
   * Watch setup uses this partial result so a repaired module or package boundary can restart a failed configuration cycle.
   */
  public list(): IEvidenceSourceDependency[] {
    return Array.from(this.dependencies.values()).sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
  }

  /** Watches and parses one physical module once, then follows its static specifiers.
   *
   * Logical and real paths are both retained because symlink changes can alter resolution even when the parsed physical file is unchanged.
   */
  private async scanFile(file: string): Promise<void> {
    const logical = SourcePath.slash(path.resolve(file));
    this.watch(logical, false);
    this.watch(SourcePath.slash(path.dirname(logical)), true);

    const physical = SourcePath.slash(await realpath(logical));
    this.watch(physical, false);
    this.watch(SourcePath.slash(path.dirname(physical)), true);
    if (
      logical === SourcePath.slash(path.resolve(this.configFile)) &&
      programmingType(physical) !== undefined
    )
      await this.watchModuleScope(physical);
    if (this.scanned.has(physical)) return;
    this.scanned.add(physical);

    const type = programmingType(physical);
    if (type === undefined) return;
    const content = await readFile(physical, "utf8");
    const specifiers = await this.parser.parse(
      { type, file: physical, content },
      collectSpecifiers,
    );
    for (const specifier of specifiers)
      for (const resolved of await this.resolve(physical, specifier))
        await this.scanFile(resolved);
  }

  /** Resolves one static specifier while recording paths that can alter its resolution.
   *
   * Local, file URL, and package forms use their respective Node-compatible lookup paths before recursive scanning continues.
   */
  private async resolve(owner: string, specifier: string): Promise<string[]> {
    if (specifier.startsWith("node:") || isBuiltin(specifier)) return [];
    if (specifier.startsWith("file:"))
      return this.resolveExact(fileURLToPath(specifier));
    if (specifier.startsWith(".") || path.isAbsolute(specifier)) {
      const base = path.resolve(path.dirname(owner), specifier);
      try {
        return await this.resolvePath(base);
      } catch (cause) {
        try {
          return await this.resolveExact(
            createRequire(owner).resolve(specifier),
          );
        } catch {
          throw cause;
        }
      }
    }

    await this.watchPackageResolution(owner, packageSpecifier(specifier));
    try {
      return this.resolveExact(createRequire(owner).resolve(specifier));
    } catch (cause) {
      await this.watchMissingPackage(owner, specifier);
      throw new Error(
        `Could not resolve configuration import '${specifier}' from ${owner}.`,
        { cause },
      );
    }
  }

  /** Watches package boundaries whose module mode changes temporary config evaluation.
   *
   * The nearest `package.json` controls Node module kind, so its appearance or replacement must invalidate the configuration dependency set.
   */
  private async watchModuleScope(file: string): Promise<void> {
    let directory = path.dirname(file);
    for (;;) {
      const manifest = SourcePath.slash(path.join(directory, "package.json"));
      this.watch(manifest, false);
      try {
        if ((await stat(manifest)).isFile()) return;
      } catch (cause) {
        if (!absent(cause)) throw cause;
      }
      const parent = path.dirname(directory);
      if (parent === directory) return;
      directory = parent;
    }
  }

  /** Watches each `node_modules` candidate searched by Node package resolution.
   *
   * A package installed higher in the directory tree can make a previously unresolved configuration import valid.
   */
  private async watchPackageResolution(
    owner: string,
    packageName: string,
  ): Promise<void> {
    let directory = path.dirname(owner);
    for (;;) {
      const nodeModules = SourcePath.slash(
        path.join(directory, "node_modules"),
      );
      const packageDirectory = SourcePath.slash(
        path.join(nodeModules, packageName),
      );
      this.watch(packageDirectory, false);
      this.watch(
        SourcePath.slash(path.join(packageDirectory, "package.json")),
        false,
      );
      const parent = path.dirname(directory);
      if (parent === directory) return;
      directory = parent;
    }
  }

  /** Validates an exact resolved module and watches its parent for deletion or replacement.
   *
   * The parent dependency lets watch mode notice a module that disappears after resolution has succeeded.
   */
  private async resolveExact(file: string): Promise<string[]> {
    const location = SourcePath.slash(path.resolve(file));
    this.watch(location, false);
    this.watch(SourcePath.slash(path.dirname(location)), true);
    if ((await stat(location)).isFile()) return [location];
    throw new Error(`Configuration module '${location}' is not a file.`);
  }

  /** Tries TypeScript-aware local extension candidates in deterministic order.
   *
   * The ordered candidates mirror supported config imports so a newly created higher-precedence file can restart resolution.
   */
  private async resolvePath(base: string): Promise<string[]> {
    const candidates = moduleCandidates(base);
    for (const candidate of candidates) {
      this.watch(SourcePath.slash(candidate), false);
      try {
        if ((await stat(candidate)).isFile()) return [candidate];
      } catch (cause) {
        if (!absent(cause)) throw cause;
      }
    }
    this.watch(SourcePath.slash(path.dirname(base)), true);
    throw new Error(`Could not resolve local configuration module '${base}'.`);
  }

  /** Retains recursive missing package paths so installation or repair restarts the watch cycle.
   *
   * Failed package resolution still establishes dependencies on every searched package root instead of becoming a terminal blind spot.
   */
  private async watchMissingPackage(
    owner: string,
    specifier: string,
  ): Promise<void> {
    const packageName = packageSpecifier(specifier);
    let directory = path.dirname(owner);
    for (;;) {
      const nodeModules = SourcePath.slash(
        path.join(directory, "node_modules"),
      );
      this.watch(nodeModules, true);
      this.watch(SourcePath.slash(path.join(nodeModules, packageName)), true);
      const parent = path.dirname(directory);
      if (parent === directory) return;
      directory = parent;
    }
  }

  /** Merges duplicate dependencies and upgrades them to recursive observation when needed.
   *
   * A path reached through several import routes retains the strongest watch requirement without duplicate entries.
   */
  private watch(location: string, recursive: boolean): void {
    const previous = this.dependencies.get(location);
    this.dependencies.set(location, {
      path: location,
      recursive: recursive || previous?.recursive === true,
    });
  }
}

/** Extracts only statically knowable imports and rejects dynamic dependency expressions.
 *
 * Configuration watching can follow a fixed dependency graph, but dynamic `import` or `require` arguments require runtime execution and therefore fail visibly.
 */
function collectSpecifiers(session: EvidenceParseSession): string[] {
  const output = new Set<string>();
  for (const statement of session.root.namedChildren) {
    if (
      statement.type !== "import_statement" &&
      statement.type !== "export_statement"
    )
      continue;
    if (EcmaScriptSyntax.token(statement, "type")) continue;
    const direct = EcmaScriptSyntax.module(
      statement.childForFieldName("source"),
    );
    if (direct !== undefined) output.add(direct);
    else if (statement.type === "import_statement") {
      const literal = statement.descendantsOfType("string").at(-1);
      const nested = EcmaScriptSyntax.module(literal ?? null);
      if (nested !== undefined) output.add(nested);
    }
  }
  for (const call of session.root.descendantsOfType("call_expression")) {
    const callee = call.childForFieldName("function");
    if (callee?.text !== "import" && callee?.text !== "require") continue;
    const argumentsNode = call.childForFieldName("arguments");
    const argument =
      argumentsNode === null
        ? undefined
        : argumentsNode.namedChildren.find((child) => child.type === "string");
    const specifier = EcmaScriptSyntax.module(argument ?? null);
    if (specifier === undefined)
      throw new Error(
        `Configuration ${callee.text}() dependencies require one static string literal.`,
      );
    output.add(specifier);
  }
  return Array.from(output);
}

/** Chooses a parser only for JavaScript-family modules relevant to configuration imports.
 *
 * Non-code files can be resolved as dependencies but are not recursively parsed for module specifiers.
 */
function programmingType(file: string): EvidenceProgrammingType | undefined {
  const extension = path.extname(file).toLowerCase();
  if ([".ts", ".tsx", ".cts", ".mts"].includes(extension)) return "typescript";
  if ([".js", ".jsx", ".cjs", ".mjs"].includes(extension)) return "javascript";
  return undefined;
}

/** Produces the supported local TypeScript and JavaScript extension fallback order.
 *
 * Local import resolution uses this ordered list to match configuration evaluation and register each candidate for watch recovery.
 */
function moduleCandidates(base: string): string[] {
  const extension = path.extname(base).toLowerCase();
  if (extension === ".js" || extension === ".jsx")
    return unique([
      replaceExtension(base, ".ts"),
      replaceExtension(base, ".tsx"),
      base,
    ]);
  if (extension === ".mjs")
    return unique([replaceExtension(base, ".mts"), base]);
  if (extension === ".cjs")
    return unique([replaceExtension(base, ".cts"), base]);
  if (extension !== "") return [base];
  const extensions = [
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
  ];
  return unique([
    base,
    ...extensions.map((value) => base + value),
    ...extensions.map((value) => path.join(base, "index" + value)),
  ]);
}

/** Replaces an existing extension without applying path normalization.
 *
 * Candidate generation preserves the authored base path while trying TypeScript counterparts for JavaScript spellings.
 */
function replaceExtension(file: string, extension: string): string {
  return file.slice(0, -path.extname(file).length) + extension;
}

/** Retains each candidate's first occurrence while eliminating fallback duplicates.
 *
 * This preserves deterministic resolution precedence when extension substitution produces the same path twice.
 */
function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

/** Extracts the package root so subpath resolution watches the owning package boundary.
 *
 * Scoped specifiers retain their first two segments; ordinary packages retain only the first segment.
 */
function packageSpecifier(specifier: string): string {
  const segments = specifier.split("/");
  return specifier.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : (segments[0] ?? specifier);
}

/** Identifies expected missing-path errors that resolution can continue past.
 *
 * Resolution probes may skip absent candidates, whereas permission and other filesystem failures must remain diagnostic.
 */
function absent(cause: unknown): boolean {
  return (
    cause instanceof Error &&
    "code" in cause &&
    (cause.code === "ENOENT" || cause.code === "ENOTDIR")
  );
}
