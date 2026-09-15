/** How a researched grammar can provide WASM compatible with the packaged runtime.
 *
 * A release asset can be downloaded and pinned directly. A source build needs a
 * reproducible compilation route before the candidate can become a certified
 * adapter, so callers must not treat the two states as interchangeable.
 */
export type EvidGrammarWasmAvailability = "release-asset" | "source-build";
