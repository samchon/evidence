/**
 * Node condition set used by one configuration module request.
 *
 * The dependency scanner carries this distinction from syntax into package
 * resolution so its watch set names the same entry that the config evaluator
 * executes. Losing it would turn an ESM import into a CommonJS observation.
 */
export type EvidConfigModuleMode = "import" | "require";
