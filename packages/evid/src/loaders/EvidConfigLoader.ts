import { readFile, realpath, stat } from "node:fs/promises";
import { resolve } from "node:path";
import typia from "typia";
import type { TypeGuardError } from "typia";

import { createEvidConfigPlan } from "../internal/createEvidConfigPlan";
import { EvidConfigFormat } from "../internal/EvidConfigFormat";
import { EvidArtifactTypes } from "../internal/EvidArtifactTypes";
import { evaluateTypeScriptConfig } from "../internal/evaluateTypeScriptConfig";
import { validateEvidConfig } from "../internal/validateEvidConfig";
import type { IEvidConfig } from "../structures/IEvidConfig";
import type { IEvidConfigPlan } from "../structures/IEvidConfigPlan";

/**
 * Loads and validates Evid configuration before artifact I/O begins.
 *
 * JSON is read as data; TypeScript is evaluated through the consumer's ttsx with
 * output isolated from report stdout. Validation covers disabled declarations too.
 * Call load to retain authored configuration or plan to resolve inherited policy
 * and remove inactive populations before source discovery.
 *
 * @example
 * const plan: IEvidConfigPlan = await EvidConfigLoader.plan(
 *   "./config/evidence.config.ts",
 * );
 * // Population roots are anchored to the resolved configuration file.
 */
export namespace EvidConfigLoader {
  /**
   * Loads authored configuration and validates every claim and reference.
   *
   * JSON data and TypeScript default exports share artifact and shape validation.
   * Evaluation output goes to stderr, and failures reject rather than returning
   * partially validated configuration. Inactive declarations are still checked.
   *
   * @param file Configuration path, relative to the current working directory.
   */
  export async function load(
    file: string = "evidence.config.ts",
  ): Promise<IEvidConfig> {
    const filename = await resolveConfigFile(file);
    const config = await evaluateResolvedConfig(filename);
    validateEvidConfig(config, filename);
    return config;
  }

  /**
   * Loads configuration into a plan with resolved policy and selector defaults.
   *
   * Validation precedes filtering, so malformed disabled settings still fail.
   * Disabled and off populations are omitted before artifact I/O while active
   * entries retain their authored indices and configuration-relative roots.
   */
  export async function plan(
    file: string = "evidence.config.ts",
  ): Promise<IEvidConfigPlan> {
    const filename = await resolveConfigFile(file);
    return createEvidConfigPlan(
      await evaluateResolvedConfig(filename),
      filename,
    );
  }
}

/**
 * Resolves a supported configuration path to an existing physical file.
 *
 * Both logical and resolved spellings must use a supported format. Evaluation
 * follows the resolved filename, and a symlink to an unsupported target is rejected.
 */
async function resolveConfigFile(file: string): Promise<string> {
  EvidConfigFormat.get(file);
  const filename = await realpath(resolve(file));
  EvidConfigFormat.get(filename);
  if (!(await stat(filename)).isFile())
    throw new Error(`Evid configuration must be a file: ${filename}`);
  return filename;
}

/**
 * Evaluates an already resolved file and validates its configuration shape.
 *
 * Artifact identifiers receive a focused certification diagnostic before the
 * generated shape validator handles the remaining contract. JSON BOM removal
 * permits ordinary UTF-8 files without treating their strings as executable imports.
 */
async function evaluateResolvedConfig(
  filename: string,
): Promise<IEvidConfig> {
  const value: unknown =
    EvidConfigFormat.get(filename) === "json"
      ? JSON.parse((await readFile(filename, "utf8")).replace(/^\uFEFF/u, ""))
      : await evaluateTypeScriptConfig(filename);
  validateArtifactTypes(value);
  return typia.assert<IEvidConfig>(value, configurationShapeError);
}

/**
 * Attributes unsupported artifact identifiers to exact claim/reference paths.
 *
 * This preflight only traverses recognizable containers. General malformed shapes
 * remain the generated validator's responsibility rather than being accepted here.
 */
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

/**
 * Rejects a string discriminator with no shipped certified adapter.
 *
 * Non-string values are left for shape validation so this check reports only the
 * artifact-availability problem it can diagnose with a precise configuration path.
 */
function validateArtifactType(value: unknown, path: string): void {
  if (typeof value !== "string" || EvidArtifactTypes.isSupported(value))
    return;
  throw new Error(
    `Invalid Evid configuration at ${path}: artifact type '${value}' has no certified Evid adapter. Supported types: ${EvidArtifactTypes.supported().join(", ")}.`,
  );
}

/**
 * Narrows a value enough to inspect named configuration fields during preflight.
 *
 * This only establishes safe object access; full shape validity is checked by typia.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Exposes array entries for artifact preflight without assuming their element shape.
 *
 * Non-arrays return undefined so single-reference handling or shape validation
 * can decide the appropriate interpretation.
 */
function unknownArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

/**
 * Converts generated shape-validation details into an author-facing configuration error.
 *
 * The message removes the validator's synthetic root name and distinguishes a
 * missing value from a wrong type without serializing arbitrary configuration data.
 */
function configurationShapeError(props: TypeGuardError.IProps): Error {
  const path = (props.path ?? "$input").replace(/^\$input\.?/u, "");
  const location = path === "" ? "configuration" : path;
  const received =
    props.value === undefined
      ? "the value is missing"
      : "the value has another type";
  return new Error(
    `Invalid Evid configuration at ${location}: expected ${props.expected}; ${received}.`,
  );
}
