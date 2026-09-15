import { createHash } from "node:crypto";
import path from "node:path";

import typia from "typia";

import { EvidInventory } from "../../graph/EvidInventory";
import { EvidSourceLoader } from "../../loaders/EvidSourceLoader";
import { EvidTagParser } from "../../parsers/EvidTagParser";
import type { IEvidRemoteSwaggerSource } from "./IEvidRemoteSwaggerSource";
import type { IEvidSwaggerOperation } from "./IEvidSwaggerOperation";
import type { IEvidYamlScalarMapping } from "./IEvidYamlScalarMapping";
import { EvidSourcePath } from "../../internal/EvidSourcePath";
import { EvidSourceText } from "../../internal/EvidSourceText";
import { EvidSwaggerDescription } from "./EvidSwaggerDescription";
import { EvidSwaggerDocumentLoader } from "./EvidSwaggerDocumentLoader";
import { EvidSwaggerRemoteReader } from "./EvidSwaggerRemoteReader";
import type { IEvidAdapter } from "../../structures/IEvidAdapter";
import type { IEvidDocumentation } from "../../structures/IEvidDocumentation";
import type { IEvidHost } from "../../structures/IEvidHost";
import type { IEvidInventory } from "../../structures/IEvidInventory";
import type { IEvidSourceFile } from "../../structures/IEvidSourceFile";
import type { IEvidSourceSnapshot } from "../../structures/IEvidSourceSnapshot";
import type { IEvidUnit } from "../../structures/IEvidUnit";
import type { IEvidUnitSite } from "../../structures/IEvidUnitSite";
import type { EvidArtifactType } from "../../typings/EvidArtifactType";

/**
 * Extracts Swagger/OpenAPI operations and their description-based annotation hosts.
 *
 * Local snapshots and explicitly configured remote documents pass through the
 * same normalization and materialization path. Each method/path operation retains
 * its own identity even without a description, while supported description spans
 * map annotations back to source coordinates. EvidDocument failures remain incomplete.
 */
export class EvidSwaggerAdapter implements IEvidAdapter {
  /**
   * Artifact discriminator selecting API-operation extraction.
   *
   * Operations use method/path targets within each independent document population.
   */
  public readonly type: EvidArtifactType = "swagger";

  /**
   * Normalizes captured JSON/YAML documents into operation inventories.
   *
   * Each document failure is retained alongside successfully loaded documents.
   * Input is cloned, and final inventory validation preserves incompleteness rather
   * than treating failed normalization as a document with no operations.
   */
  public async analyze(
    snapshot: IEvidSourceSnapshot,
  ): Promise<IEvidInventory> {
    const input = structuredClone(typia.assert(snapshot));
    const inventory = this.inventory(input);
    if (input.files.length === 0)
      return new EvidInventory([inventory]).snapshot();

    // Keep every document's outcome: one failed normalization must not discard
    // useful diagnostics from peers or be interpreted as an empty operation set.
    const loaded = await Promise.allSettled(
      input.files.map((source) => EvidSwaggerDocumentLoader.load(source)),
    );
    loaded.forEach((entry, index) => {
      const source = input.files[index];
      if (source === undefined) return;
      if (entry.status === "rejected") {
        const reason: unknown = entry.reason;
        inventory.complete = false;
        inventory.diagnostics.push({
          code: "swagger-normalization-failed",
          severity: "error",
          message: `The Swagger document could not be normalized: ${this.message(reason)}`,
          repair:
            "Correct the JSON/YAML document and use a Swagger 2.0 or supported OpenAPI 3.x shape.",
          location: { file: source.physicalPath },
        });
      } else this.materialize(inventory, source, entry.value.operations);
    });
    return new EvidInventory([inventory]).snapshot();
  }

  /**
   * Loads one exact local document or explicitly configured HTTP(S) URL.
   *
   * Local paths resolve from the configuration-relative root and use source-loader
   * dependency tracking. Remote bytes become a synthetic source snapshot without
   * filesystem dependencies. Access and normalization failures return incomplete
   * inventory diagnostics for the requested document.
   */
  public async load(
    configFile: string,
    file: string,
    root: string = ".",
  ): Promise<IEvidInventory> {
    let display: string = EvidSwaggerRemoteReader.safeDisplay(file);
    try {
      if (file === "" || file.trim() !== file)
        throw new Error("A Swagger source must not be empty or padded.");
      const remote: URL | undefined = EvidSwaggerRemoteReader.parse(file);
      if (remote === undefined)
        return await this.analyze(
          await EvidSourceLoader.file(configFile, file, root),
        );
      display = EvidSwaggerRemoteReader.display(remote);
      const read: IEvidRemoteSwaggerSource = await EvidSwaggerRemoteReader.read(remote);
      const absoluteRoot: string = EvidSourcePath.root(configFile, root);
      return await this.analyze({
        root: {
          declared: root,
          absolute: absoluteRoot,
          display: EvidSourcePath.display(
            path.dirname(path.resolve(configFile)),
            absoluteRoot,
          ),
        },
        files: [
          {
            id: `swagger:remote:${createHash("sha256").update(file).digest("hex")}`,
            physicalPath: display,
            fingerprintPath: display,
            content: read.content,
            digest: read.digest,
            addresses: [
              {
                absolute: display,
                relative: display,
                display,
              },
            ],
          },
        ],
        dependencies: [],
        diagnostics: [],
        complete: true,
      });
    } catch (cause) {
      return this.failure(
        display,
        EvidSwaggerRemoteReader.safeMessage(cause, file),
      );
    }
  }

  /**
   * Seeds an operation inventory with snapshot provenance and discovery failures.
   *
   * Operation and annotation collections remain empty until document normalization
   * establishes supported API structure and source mappings.
   */
  private inventory(input: IEvidSourceSnapshot): IEvidInventory {
    return {
      schemaVersion: 1,
      sources: input.files,
      annotationRanges: [],
      units: [],
      addresses: [],
      hosts: [],
      declarations: [],
      reviews: [],
      diagnostics: input.diagnostics.map((diagnostic) => ({
        code: `source-${diagnostic.code}`,
        severity: "error",
        message: diagnostic.message,
        repair:
          "Restore access to the selected Swagger source before evaluating coverage.",
        location: { file: diagnostic.path },
      })),
      dependencies: input.dependencies,
      complete: input.complete,
    };
  }

  /**
   * Creates semantic operation units and mapped description carriers.
   *
   * Source identity qualifies each operation token so separate documents do not
   * merge accidentally. Operations remain represented even when no description
   * supplies an annotation, preserving per-host coverage requirements.
   */
  private materialize(
    inventory: IEvidInventory,
    source: IEvidSourceFile,
    operations: IEvidSwaggerOperation[],
  ): void {
    const text = new EvidSourceText(source.content);
    for (const operation of operations) {
      const range = operation.location?.range ?? text.range(0, 0);
      const unitId = `swagger:${source.id}:${operation.target}`;
      const site: IEvidUnitSite = {
        id: `${unitId}:site`,
        file: source.physicalPath,
        range,
        content: [range],
      };
      const unit: IEvidUnit = {
        id: unitId,
        type: "swagger",
        symbol: "operation",
        identity: [operation.target],
        name: operation.target,
        contentDigest: operation.digest,
        sites: [site],
        withdrawals: [],
      };
      inventory.units.push(unit);
      inventory.addresses.push({
        unitId,
        file: "swagger:",
        segments: [operation.target],
      });

      const mapping = operation.location?.description;
      const host: IEvidHost = {
        id: `${unitId}:description`,
        file: source.physicalPath,
        range: mapping?.range ?? range,
        origins: source.addresses.map((address) => address.absolute),
        siteId: site.id,
        unitIds: [unit.id],
        attachment: "attached",
      };
      inventory.hosts.push(host);
      if (mapping !== undefined) this.parse(inventory, source, host, mapping);
      else if (
        operation.description !== undefined &&
        EvidSwaggerDescription.hasMetadata(operation.description)
      ) {
        inventory.complete = false;
        inventory.diagnostics.push({
          code: "swagger-description-location",
          severity: "error",
          message: `The description for '${operation.target}' contains Evid metadata without a verifiable source scalar.`,
          repair:
            "Write the operation description as a direct JSON/YAML string or scalar alias so its annotation positions can be verified.",
          location: { file: source.physicalPath, range },
          hostId: host.id,
        });
      }
    }
  }

  /**
   * Parses one mapped operation description into inventory annotations.
   *
   * Declarations, reviews, diagnostics, and their exact source ranges are copied
   * together so fingerprinting can exclude metadata without dropping prose.
   */
  private parse(
    inventory: IEvidInventory,
    source: IEvidSourceFile,
    host: IEvidHost,
    mapping: IEvidYamlScalarMapping,
  ): void {
    const documentation: IEvidDocumentation = {
      hostId: host.id,
      text: mapping.text,
      offsets: mapping.offsets,
      ends: mapping.ends,
      tagBoundaries: false,
      allowWithdrawal: false,
    };
    const parsed = EvidTagParser.parse(source.content, host, documentation);
    inventory.declarations.push(...parsed.declarations);
    inventory.reviews.push(...parsed.reviews);
    inventory.diagnostics.push(...parsed.diagnostics);
    inventory.annotationRanges.push(
      ...parsed.declarations.map((entry) => entry.location),
      ...parsed.reviews.map((entry) => entry.location),
      ...parsed.diagnostics
        .map((entry) => entry.location)
        .filter((entry) => entry !== undefined),
    );
  }

  /**
   * Creates an incomplete inventory for one safely described source failure.
   *
   * The diagnostic retains the requested source label while an empty population
   * cannot be mistaken for a complete Swagger document.
   */
  private failure(file: string, message: string): IEvidInventory {
    return new EvidInventory([
      {
        schemaVersion: 1,
        sources: [],
        annotationRanges: [],
        units: [],
        addresses: [],
        hosts: [],
        declarations: [],
        reviews: [],
        diagnostics: [
          {
            code: "swagger-source-failed",
            severity: "error",
            message: `The Swagger source could not be loaded: ${message}`,
            repair:
              "Correct the exact local path or HTTP(S) URL and restore access to the document.",
            location: { file },
          },
        ],
        dependencies: [],
        complete: false,
      },
    ]).snapshot();
  }

  /**
   * Converts an unknown local analysis failure into diagnostic text.
   *
   * Remote load failures use EvidSwaggerRemoteReader's credential-safe boundary
   * before they reach this adapter.
   */
  private message(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
  }
}
