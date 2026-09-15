/**
 * Supported advanced source, configuration, and parser-cache utilities.
 *
 * Test and integration authors use these boundaries through the package entry
 * point rather than reaching into package source paths. Other internal modules
 * remain implementation details and are intentionally not re-exported.
 */
export * from "./createEvidConfigPlan";
export * from "./evaluateTypeScriptConfig";
export * from "./EvidConfigDependencyScanner";
export * from "./EvidFileGlob";
export * from "./EvidSourcePath";
export * from "./EvidSourceText";
export * from "./EvidTreeSitterAssetCache";
export * from "./EvidTreeSitterAssets";
export * from "./EvidTreeSitterAssetScope";
export * from "./EvidWatchDependencySnapshot";
export * from "./validateEvidConfig";
