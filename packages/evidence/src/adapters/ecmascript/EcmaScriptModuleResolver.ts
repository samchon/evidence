import { readFile } from "node:fs/promises";
import path from "node:path";

import typia from "typia";

import type { IEvidenceDiagnostic } from "../../structures/IEvidenceDiagnostic";
import type { IEvidenceSourceDependency } from "../../structures/IEvidenceSourceDependency";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { EcmaScriptModuleMode } from "./EcmaScriptModuleMode";
import type { IEcmaScriptModuleResolution } from "./IEcmaScriptModuleResolution";
import type { IJavaScriptPackageJson } from "./IJavaScriptPackageJson";
import { SourcePath } from "../../internal/SourcePath";

/** Selects ESM or CommonJS semantics and records controlling package metadata. */
export class EcmaScriptModuleResolver {
  private readonly dependencies = new Map<string, IEvidenceSourceDependency>();
  private readonly diagnostics: IEvidenceDiagnostic[] = [];
  private readonly packages = new Map<string, Promise<EcmaScriptModuleMode>>();

  public async resolve(
    sources: IEvidenceSourceFile[],
  ): Promise<IEcmaScriptModuleResolution> {
    const modes = new Map<string, EcmaScriptModuleMode>();
    await Promise.all(
      sources.map(async (source) => {
        const addresses =
          source.addresses.length === 0
            ? [source.physicalPath]
            : source.addresses.map((address) => address.absolute);
        const selected = new Set(
          await Promise.all(addresses.map((file) => this.mode(file))),
        );
        if (selected.size !== 1)
          this.problem(
            "javascript-module-mode",
            "Logical aliases of one JavaScript source select different module modes.",
            "Keep aliases under package scopes with the same type or select one logical file.",
            source.physicalPath,
          );
        modes.set(source.id, selected.values().next().value ?? "commonjs");
      }),
    );
    return {
      modes,
      dependencies: Array.from(this.dependencies.values()),
      diagnostics: this.diagnostics,
      complete: this.diagnostics.length === 0,
    };
  }

  private async mode(file: string): Promise<EcmaScriptModuleMode> {
    const extension = path.extname(file).toLowerCase();
    if (extension === ".mjs") return "esm";
    if (extension === ".cjs") return "commonjs";
    return this.packageMode(path.dirname(path.resolve(file)));
  }

  private packageMode(directory: string): Promise<EcmaScriptModuleMode> {
    const key = SourcePath.slash(path.resolve(directory));
    const cached = this.packages.get(key);
    if (cached !== undefined) return cached;
    const pending = this.readPackageMode(key);
    this.packages.set(key, pending);
    return pending;
  }

  private async readPackageMode(
    directory: string,
  ): Promise<EcmaScriptModuleMode> {
    const manifest = SourcePath.slash(path.join(directory, "package.json"));
    this.dependencies.set(manifest, { path: manifest, recursive: false });
    try {
      const content = await readFile(manifest, "utf8");
      const metadata = typia.json.assertParse<IJavaScriptPackageJson>(
        content.replace(/^\uFEFF/u, ""),
      );
      if (metadata.type === undefined || metadata.type === "commonjs")
        return "commonjs";
      if (metadata.type === "module") return "esm";
      this.problem(
        "javascript-package-type",
        `Package metadata declares unsupported JavaScript module type '${metadata.type}'.`,
        "Use 'module' or 'commonjs' for the package.json type field.",
        manifest,
      );
      return "commonjs";
    } catch (cause) {
      if (this.absent(cause)) {
        const parent = path.dirname(directory);
        return parent === directory ? "commonjs" : this.packageMode(parent);
      }
      this.problem(
        "javascript-package-json",
        `Could not read JavaScript module metadata: ${this.message(cause)}`,
        "Correct the nearest package.json before evaluating JavaScript coverage.",
        manifest,
      );
      return "commonjs";
    }
  }

  private absent(cause: unknown): boolean {
    return cause instanceof Error && "code" in cause && cause.code === "ENOENT";
  }

  private message(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
  }

  private problem(
    code: string,
    message: string,
    repair: string,
    file: string,
  ): void {
    this.diagnostics.push({
      code,
      severity: "error",
      message,
      repair,
      location: { file },
    });
  }
}
