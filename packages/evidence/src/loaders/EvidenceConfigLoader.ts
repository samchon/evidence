import { readFile, realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import typia from "typia";
import type { TypeGuardError } from "typia";

import { createEvidenceConfigPlan } from "../internal/createEvidenceConfigPlan";
import { EvidenceConfigFormat } from "../internal/EvidenceConfigFormat";
import { EvidenceArtifactTypes } from "../internal/EvidenceArtifactTypes";
import { evaluateTypeScriptConfig } from "../internal/evaluateTypeScriptConfig";
import { validateEvidenceConfig } from "../internal/validateEvidenceConfig";
import type { IEvidenceConfig } from "../structures/IEvidenceConfig";
import type { IEvidenceConfigPlan } from "../structures/IEvidenceConfigPlan";

/** Loads JSON directly or evaluates TypeScript through the consumer's ttsx. */
export namespace EvidenceConfigLoader {
  /**
   * Loads JSON or a TS default export, then validates every declaration.
   * Evaluator output goes to stderr.
   *
   * @param file Configuration path, relative to the current working directory.
   */
  export async function load(
    file: string = "evidence.config.ts",
  ): Promise<IEvidenceConfig> {
    const filename = await resolveConfigFile(file);
    const config = await evaluateResolvedConfig(filename);
    validateEvidenceConfig(config, filename);
    return config;
  }

  /**
   * Loads and validates every declaration, then resolves active severities and
   * selector defaults. Disabled and off populations are omitted before artifact I/O.
   */
  export async function plan(
    file: string = "evidence.config.ts",
  ): Promise<IEvidenceConfigPlan> {
    const filename = await resolveConfigFile(file);
    return createEvidenceConfigPlan(
      await evaluateResolvedConfig(filename),
      filename,
    );
  }
}

async function resolveConfigFile(file: string): Promise<string> {
  EvidenceConfigFormat.get(file);
  const filename = await realpath(resolve(file));
  EvidenceConfigFormat.get(filename);
  if (!(await stat(filename)).isFile())
    throw new Error(`Evidence configuration must be a file: ${filename}`);
  return filename;
}

async function evaluateResolvedConfig(
  filename: string,
): Promise<IEvidenceConfig> {
  const value: unknown =
    EvidenceConfigFormat.get(filename) === "json"
      ? JSON.parse((await readFile(filename, "utf8")).replace(/^\uFEFF/u, ""))
      : await evaluateTypeScriptConfig(filename);
  validateArtifactTypes(value);
  return typia.assert<IEvidenceConfig>(value, configurationShapeError);
}

function validateArtifactTypes(value: unknown): void {
  if (!isRecord(value)) return;
  const claims = unknownArray(value["claims"]);
  if (claims === undefined) return;
  claims.forEach((claim, claimIndex) => {
    if (!isRecord(claim)) return;
    validateArtifactType(claim["type"], `claims[${claimIndex}].type`);
    const references = unknownArray(claim["reference"]);
    if (references !== undefined)
      references.forEach((reference, referenceIndex) => {
        if (isRecord(reference))
          validateArtifactType(
            reference["type"],
            `claims[${claimIndex}].reference[${referenceIndex}].type`,
          );
      });
    else if (isRecord(claim["reference"]))
      validateArtifactType(
        claim["reference"]["type"],
        `claims[${claimIndex}].reference.type`,
      );
  });
}

function validateArtifactType(value: unknown, path: string): void {
  if (typeof value !== "string" || EvidenceArtifactTypes.isSupported(value))
    return;
  throw new Error(
    `Invalid Evidence configuration at ${path}: artifact type '${value}' has no certified Evidence adapter. Supported types: ${EvidenceArtifactTypes.supported().join(", ")}.`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unknownArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function configurationShapeError(props: TypeGuardError.IProps): Error {
  const path = (props.path ?? "$input").replace(/^\$input\.?/u, "");
  const location = path === "" ? "configuration" : path;
  const received =
    props.value === undefined
      ? "the value is missing"
      : "the value has another type";
  return new Error(
    `Invalid Evidence configuration at ${location}: expected ${props.expected}; ${received}.`,
  );
}
