import type { EvidenceEcmaScriptExportKind } from "./EvidenceEcmaScriptExportKind";

/**
 * Describes one static export edge discovered in an ECMAScript-family module.
 *
 * The export resolver follows these edges through the source snapshot to expose
 * local units under their public module names and diagnose unsupported
 * targets.
 */
export interface IEvidenceEcmaScriptExport {
  /**
   * Export form that determines how the resolver follows this edge.
   *
   * The kind distinguishes local declarations from named, namespace, and star
   * re-exports, whose optional names and specifier have different meanings.
   */
  kind: EvidenceEcmaScriptExportKind;

  /**
   * Name introduced by this module's public export surface.
   *
   * Omission is valid for star exports, which contribute each eligible public
   * name from the referenced module except its default export.
   */
  publicName?: string;

  /**
   * Local binding name exported directly from this module.
   *
   * It is present for local export edges and lets the resolver distinguish a
   * declared root from an imported binding that must be followed further.
   */
  localName?: string;

  /**
   * Name requested from the referenced module by a named re-export.
   *
   * Omission means this edge does not select one imported member, as with
   * local, namespace, and star export forms.
   */
  importedName?: string;

  /**
   * Raw module specifier naming the re-export target.
   *
   * Omission means the exported binding is local; when present, resolution is
   * limited to supported files inside the declared source snapshot.
   */
  specifier?: string;

  /**
   * Whether this edge exports only TypeScript type-space declarations.
   *
   * The resolver combines this flag with every edge it traverses so value-only
   * units cannot appear through a type-only public address.
   */
  typeOnly: boolean;
}
