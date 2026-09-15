/**
 * Public package API.
 *
 * Importing this entry point registers no parser work, configuration loading,
 * or command execution. Consumers choose explicit checker, command, loader, and
 * adapter entry points for their own execution boundary.
 */
export * from "./adapters";
export * from "./commands";
export { EvidChecker } from "./EvidChecker";
export * from "./graph";
export * from "./internal";
export * from "./loaders";
export * from "./parsers";
export * from "./reporters";
export type * from "./structures";
export * from "./targets";
export type * from "./typings";
