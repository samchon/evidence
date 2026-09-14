import { createHash } from "node:crypto";
import path from "node:path";

import typia from "typia";

import { EvidenceInventory } from "../../graph/EvidenceInventory";
import { EvidenceSourceLoader } from "../../loaders/EvidenceSourceLoader";
import { EvidenceTagParser } from "../../parsers/EvidenceTagParser";
import type { ISwaggerOperation } from "./ISwaggerOperation";
import type { IYamlScalarMapping } from "./IYamlScalarMapping";
import { SourcePath } from "../../internal/SourcePath";
import { SourceText } from "../../internal/SourceText";
import { SwaggerDescription } from "./SwaggerDescription";
import { SwaggerDocumentLoader } from "./SwaggerDocumentLoader";
import { SwaggerRemoteReader } from "./SwaggerRemoteReader";
import type { IEvidenceAdapter } from "../../structures/IEvidenceAdapter";
import type { IEvidenceDocumentation } from "../../structures/IEvidenceDocumentation";
import type { IEvidenceHost } from "../../structures/IEvidenceHost";
import type { IEvidenceInventory } from "../../structures/IEvidenceInventory";
import type { IEvidenceSourceFile } from "../../structures/IEvidenceSourceFile";
import type { IEvidenceSourceSnapshot } from "../../structures/IEvidenceSourceSnapshot";
import type { IEvidenceUnit } from "../../structures/IEvidenceUnit";
import type { IEvidenceUnitSite } from "../../structures/IEvidenceUnitSite";
import type { EvidenceArtifactType } from "../../typings/EvidenceArtifactType";

/** Builds Swagger/OpenAPI operation units and description hosts. */
export class EvidenceSwaggerAdapter implements IEvidenceAdapter {
  public readonly type: EvidenceArtifactType = "swagger";

  public async analyze(
    snapshot: IEvidenceSourceSnapshot,
  ): Promise<IEvidenceInventory> {
    const input = structuredClone(typia.assert(snapshot));
    const inventory = this.inventory(input);
    if (input.files.length === 0)
      return new EvidenceInventory([inventory]).snapshot();

    const loaded = await Promise.allSettled(
      input.files.map((source) => SwaggerDocumentLoader.load(source)),
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
    return new EvidenceInventory([inventory]).snapshot();
  }

  /** Loads one exact local document or explicitly configured HTTP(S) URL. */
  public async load(
    configFile: string,
    file: string,
    root: string = ".",
  ): Promise<IEvidenceInventory> {
    let display = file;
    try {
      if (file === "" || file.trim() !== file)
        throw new Error("A Swagger source must not be empty or padded.");
      const remote = SwaggerRemoteReader.parse(file);
      if (remote === undefined)
        return await this.analyze(
          await EvidenceSourceLoader.file(configFile, file, root),
        );
      display = SwaggerRemoteReader.display(remote);
      const read = await SwaggerRemoteReader.read(remote);
      const absoluteRoot = SourcePath.root(configFile, root);
      return await this.analyze({
        root: {
          declared: root,
          absolute: absoluteRoot,
          display: SourcePath.display(
            path.dirname(path.resolve(configFile)),
            absoluteRoot,
          ),
        },
        files: [
          {
            id: `swagger:remote:${createHash("sha256").update(file).digest("hex")}`,
            physicalPath: display,
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
      return this.failure(display, cause);
    }
  }

  private inventory(input: IEvidenceSourceSnapshot): IEvidenceInventory {
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

  private materialize(
    inventory: IEvidenceInventory,
    source: IEvidenceSourceFile,
    operations: ISwaggerOperation[],
  ): void {
    const text = new SourceText(source.content);
    for (const operation of operations) {
      const range = operation.location?.range ?? text.range(0, 0);
      const unitId = `swagger:${source.id}:${operation.target}`;
      const site: IEvidenceUnitSite = {
        id: `${unitId}:site`,
        file: source.physicalPath,
        range,
        content: [range],
      };
      const unit: IEvidenceUnit = {
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
      const host: IEvidenceHost = {
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
        SwaggerDescription.hasMetadata(operation.description)
      ) {
        inventory.complete = false;
        inventory.diagnostics.push({
          code: "swagger-description-location",
          severity: "error",
          message: `The description for '${operation.target}' contains Evidence metadata without a verifiable source scalar.`,
          repair:
            "Write the operation description as a direct JSON/YAML string or scalar alias so its annotation positions can be verified.",
          location: { file: source.physicalPath, range },
          hostId: host.id,
        });
      }
    }
  }

  private parse(
    inventory: IEvidenceInventory,
    source: IEvidenceSourceFile,
    host: IEvidenceHost,
    mapping: IYamlScalarMapping,
  ): void {
    const documentation: IEvidenceDocumentation = {
      hostId: host.id,
      text: mapping.text,
      offsets: mapping.offsets,
      ends: mapping.ends,
      tagBoundaries: false,
      allowWithdrawal: false,
    };
    const parsed = EvidenceTagParser.parse(source.content, host, documentation);
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

  private failure(file: string, cause: unknown): IEvidenceInventory {
    return new EvidenceInventory([
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
            message: `The Swagger source could not be loaded: ${this.message(cause)}`,
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

  private message(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
  }
}
