import { createHash } from "node:crypto";
import type { ReadableStreamReadResult } from "node:stream/web";

import type { IRemoteSwaggerSource } from "./IRemoteSwaggerSource";

const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const REMOTE_TIMEOUT_MILLISECONDS = 30_000;

/** Validates and reads explicitly configured HTTP(S) Swagger sources.
 *
 * Remote input is intentionally bounded before parsing so a configured URL
 * cannot turn schema discovery into an unbounded memory or time consumer.
 */
export namespace SwaggerRemoteReader {
  /** Parses a configured remote source only when it has a URL scheme.
   *
   * Returning `undefined` leaves ordinary paths to the local-source loader;
   * explicit remote URLs must be HTTP(S) and cannot use fragments.
   */
  export function parse(source: string): URL | undefined {
    if (!/^[A-Za-z][A-Za-z0-9+.-]*:\/\//u.test(source)) return undefined;
    const url = new URL(source);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new Error("Only HTTP(S) URLs can name a remote Swagger source.");
    if (url.hash !== "")
      throw new Error(
        "A remote Swagger document URL must not contain a fragment.",
      );
    return url;
  }

  /** Reads one remote document and fingerprints the exact accepted bytes.
   *
   * The content-length preflight and streamed byte count enforce the same limit
   * when a server omits or lies about its response header.
   */
  export async function read(url: URL): Promise<IRemoteSwaggerSource> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REMOTE_TIMEOUT_MILLISECONDS),
    });
    if (!response.ok)
      throw new Error(
        `HTTP ${response.status} ${response.statusText === "" ? "response" : response.statusText}`,
      );
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_DOCUMENT_BYTES)
      throw new Error(
        `The Swagger document exceeds the ${MAX_DOCUMENT_BYTES} byte limit.`,
      );
    if (response.body === null) return decode(new Uint8Array());
    const reader: ReadableStreamDefaultReader<Uint8Array> =
      response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    let next: ReadableStreamReadResult<Uint8Array> = await reader.read();
    while (next.done === false) {
      length += next.value.byteLength;
      if (length > MAX_DOCUMENT_BYTES) {
        await reader.cancel();
        throw new Error(
          `The Swagger document exceeds the ${MAX_DOCUMENT_BYTES} byte limit.`,
        );
      }
      chunks.push(next.value);
      next = await reader.read();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return decode(bytes);
  }

  /** Renders a safe source label for diagnostics.
   *
   * Query values may carry credentials or arbitrary user data, so their
   * presence is retained while their contents are never exposed.
   */
  export function display(url: URL): string {
    const query = url.search === "" ? "" : "?<redacted>";
    return `${url.origin}${url.pathname}${query}`;
  }
}

/** Decodes accepted bytes and keeps a byte-exact cache identity.
 *
 * Digesting before text parsing makes cache ownership independent of Unicode
 * normalization performed by later document processing.
 */
function decode(bytes: Uint8Array): IRemoteSwaggerSource {
  return {
    content: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    digest: createHash("sha256").update(bytes).digest("hex"),
  };
}
