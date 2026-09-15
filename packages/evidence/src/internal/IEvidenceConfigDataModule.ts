/**
 * Decoded dependency-bearing content of one Node data URL module.
 *
 * JavaScript modules expose source for recursive static scanning. JSON and Wasm
 * modules are immutable leaves and therefore omit content.
 */
export interface IEvidenceConfigDataModule {
  /**
   * JavaScript source text that can contain further module requests.
   *
   * JSON and Wasm data modules omit this value because they cannot add static
   * filesystem dependencies to the configuration watch set.
   */
  content?: string;
}
