import { EvidenceEcmaScriptAdapter } from "../ecmascript/EvidenceEcmaScriptAdapter";

/**
 * Extracts static TypeScript and TSX exports into a language-neutral evidence
 * inventory.
 *
 * The shared ECMAScript adapter reconciles declarations, overloads, and
 * supported local re-exports across the selected snapshot. Declaration JSDoc
 * supplies evidence hosts. File-qualified public paths retain aliases without
 * duplicating semantic units; instance members use a prototype segment, while
 * static members are addressed directly on the class.
 *
 * Analysis reads declared source without a compiler Program. Package exports,
 * path aliases, ambient modules, global augmentations, and CommonJS export
 * assignments are outside this adapter's supported publication boundary.
 *
 * @example
 *   const adapter: EvidenceTypeScriptAdapter =
 *     new EvidenceTypeScriptAdapter();
 *   const inventory: IEvidenceInventory = await adapter.analyze(snapshot);
 *   // api.ts#Client.prototype.send names an instance method.
 *   // api.ts#Client.create names a static member.
 */
export class EvidenceTypeScriptAdapter extends EvidenceEcmaScriptAdapter<"typescript"> {
  /**
   * Configures the shared extractor for TypeScript grammar and publication
   * rules.
   *
   * Construction does not parse source. The inherited `analyze` operation
   * selects TypeScript or TSX syntax from each file in the supplied snapshot.
   */
  public constructor() {
    super("TypeScript");
  }

  /**
   * TypeScript discriminator for the shared ECMAScript extraction pipeline.
   *
   * The literal return type lets adapter registries preserve this entry point's
   * artifact identity without narrowing a shared base instance at runtime.
   */
  public get type(): "typescript" {
    return "typescript";
  }
}
