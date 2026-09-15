/**
 * Programming languages that share the ECMAScript declaration and module model.
 *
 * The discriminator selects grammar-specific diagnostics while one scanner and
 * export resolver handle the common JavaScript and TypeScript surface.
 */
export type EvidEcmaScriptType = "typescript" | "javascript";
