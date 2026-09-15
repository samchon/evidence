/**
 * Supported advanced source, configuration, and parser-cache utilities.
 *
 * Test and integration authors use these boundaries through the package entry
 * point rather than reaching into package source paths. Other internal modules
 * remain implementation details and are intentionally not re-exported.
 */
export * from "./createEvidenceConfigPlan";
export * from "./evaluateTypeScriptConfig";
export * from "./EvidenceConfigDependencyScanner";
export * from "./EvidenceFileGlob";
export * from "./EvidenceSourcePath";
export * from "./EvidenceSourceText";
export * from "./EvidenceTreeSitterAssetCache";
export * from "./EvidenceTreeSitterAssets";
export * from "./EvidenceTreeSitterAssetScope";
export * from "./EvidenceWatchDependencySnapshot";
export * from "./validateEvidenceConfig";
