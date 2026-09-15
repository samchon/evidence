import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { ReadableStreamReadResult } from "node:stream/web";
import { setTimeout as delay } from "node:timers/promises";
import typia from "typia";

import { EvidenceParserError } from "../parsers/EvidenceParserError";
import type { IEvidenceGrammar } from "../structures/IEvidenceGrammar";
import type { IEvidenceGrammarAsset } from "../structures/IEvidenceGrammarAsset";
import type { IEvidenceTreeSitterAssetLock } from "./IEvidenceTreeSitterAssetLock";
import type { IEvidenceTreeSitterAssetOptions } from "./IEvidenceTreeSitterAssetOptions";
import type { IEvidenceTreeSitterAssetPending } from "./IEvidenceTreeSitterAssetPending";

/**
 * Acquires immutable upstream grammars and validates every cache read before
 * loading WASM.
 *
 * Concurrent callers share transfer work by destination but receive independent
 * byte arrays. Atomic publication and lock recovery prevent partial or
 * abandoned downloads from becoming trusted cache entries across processes.
 */
export class EvidenceTreeSitterAssetCache {
  /**
   * Tracks process-local transfers by immutable cache destination.
   *
   * Concurrent bytes calls share this pending record so they do not download
   * the same pinned grammar independently, while consumer counts govern
   * cancellation.
   */
  private static readonly pending = new Map<
    string,
    IEvidenceTreeSitterAssetPending
  >();

  /**
   * Captures asset-acquisition controls without performing filesystem or
   * network work.
   *
   * Bytes applies these controls when it resolves the cache location, downloads
   * a grammar, and reports progress for this cache instance.
   */
  public constructor(
    private readonly options: IEvidenceTreeSitterAssetOptions,
  ) {}

  /**
   * Returns verified caller-owned grammar bytes, repairing missing or damaged
   * cache entries.
   *
   * The method shares a transfer with concurrent callers but slices its result
   * so no caller can mutate another caller's buffer.
   */
  public async bytes(grammar: IEvidenceGrammar): Promise<Uint8Array> {
    const destination = path.join(
      cacheDirectory(this.options.cacheDirectory),
      "grammars-v1",
      `${String(grammar.wasm.sha256)}.wasm`,
    );
    try {
      if (this.options.signal !== undefined)
        this.options.signal.throwIfAborted();
      const cached = await verified(destination, grammar.wasm);
      if (cached !== undefined) return cached;

      let pending = EvidenceTreeSitterAssetCache.pending.get(destination);
      if (pending === undefined || pending.controller.signal.aborted) {
        const controller = new AbortController();
        pending = {
          controller,
          consumers: 0,
          promise: this.acquire(grammar, destination, controller.signal),
        };
        EvidenceTreeSitterAssetCache.pending.set(destination, pending);
      }
      ++pending.consumers;
      try {
        this.options.progress?.(
          `Preparing ${grammar.id} parser (${grammar.version})...`,
        );
        const bytes = await consume(pending.promise, this.options.signal);
        return bytes.slice();
      } finally {
        if (--pending.consumers === 0) {
          pending.controller.abort();
          // Complete owned filesystem cleanup before a cancelled caller can dispose its execution.
          await pending.promise.catch(() => undefined);
          if (EvidenceTreeSitterAssetCache.pending.get(destination) === pending)
            EvidenceTreeSitterAssetCache.pending.delete(destination);
        }
      }
    } catch (cause) {
      if (this.options.signal?.aborted === true)
        throw new EvidenceParserError(
          "asset-cancelled",
          grammar.id,
          "Parser preparation was cancelled.",
          undefined,
          { cause },
        );
      if (cause instanceof EvidenceParserError) throw cause;
      throw new EvidenceParserError(
        "asset-cache",
        destination,
        "Cannot prepare the parser cache. Restore write access or set Evidence_CACHE_DIR to an absolute writable directory.",
        undefined,
        { cause },
      );
    }
  }

  /**
   * Acquires a cross-process cache lock, verifies downloaded bytes, and
   * atomically publishes one entry.
   *
   * The finally block removes only files owned by this acquisition, preserving
   * another process's active lock and completed cache entry.
   */
  private async acquire(
    grammar: IEvidenceGrammar,
    destination: string,
    signal: AbortSignal,
  ): Promise<Uint8Array> {
    await mkdir(path.dirname(destination), { recursive: true });
    const lock = `${destination}.lock`;
    const owner: IEvidenceTreeSitterAssetLock = {
      pid: process.pid,
      token: randomUUID(),
    };
    const deadline = Date.now() + 120_000;
    for (;;) {
      signal.throwIfAborted();
      const cached = await verified(destination, grammar.wasm);
      if (cached !== undefined) return cached;
      try {
        const handle = await open(lock, "wx");
        try {
          try {
            await handle.writeFile(JSON.stringify(owner));
          } finally {
            await handle.close();
          }
        } catch (cause) {
          await rm(lock, { force: true });
          throw cause;
        }
        break;
      } catch (cause) {
        if (!fileError(cause, "EEXIST")) throw cause;
        await recoverLock(lock);
        if (Date.now() >= deadline)
          throw new EvidenceParserError(
            "asset-cache",
            destination,
            "Another process is still preparing this parser. Retry after it completes or stops.",
          );
        await delay(100, undefined, { signal });
      }
    }

    const temporary = `${destination}.${owner.token}.tmp`;
    try {
      const cached = await verified(destination, grammar.wasm);
      if (cached !== undefined) return cached;
      const bytes = await this.download(grammar, signal);
      signal.throwIfAborted();
      const handle = await open(temporary, "wx");
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      signal.throwIfAborted();
      await rename(temporary, destination);
      return bytes;
    } finally {
      await rm(temporary, { force: true });
      if ((await readLock(lock))?.token === owner.token)
        await rm(lock, { force: true });
    }
  }

  /**
   * Downloads one pinned grammar with bounded retries, response size, and
   * cancellation.
   *
   * Hash verification remains in the caller so every cache and fresh-download
   * path shares the same immutable-asset check.
   */
  private async download(
    grammar: IEvidenceGrammar,
    signal: AbortSignal,
  ): Promise<Uint8Array> {
    const attempts = this.options.attempts ?? 3;
    let failure: unknown;
    for (let attempt = 0; attempt < attempts; ++attempt) {
      signal.throwIfAborted();
      if (attempt !== 0)
        await delay(100 * 2 ** (attempt - 1), undefined, { signal });
      const timeout = new AbortController();
      const timer = setTimeout(
        () => timeout.abort(),
        this.options.timeoutMilliseconds ?? 30_000,
      );
      try {
        const response = await (this.options.fetch ?? globalThis.fetch)(
          grammar.wasm.url,
          {
            signal: AbortSignal.any([signal, timeout.signal]),
            headers: { Accept: "application/wasm, application/octet-stream" },
          },
        );
        if (!response.ok) {
          if (response.body !== null) await response.body.cancel();
          const error = new Error(`HTTP ${response.status}`);
          if (
            response.status === 408 ||
            response.status === 429 ||
            response.status >= 500
          )
            throw error;
          throw new EvidenceParserError(
            "asset-download",
            grammar.id,
            `The pinned parser URL returned HTTP ${response.status}. Restore access to ${grammar.wasm.url} and retry.`,
            undefined,
            { cause: error },
          );
        }
        const bytes = await boundedBody(response, grammar.wasm.size);
        if (!matches(bytes, grammar.wasm))
          throw new EvidenceParserError(
            "asset-corrupt",
            grammar.id,
            "Downloaded parser bytes do not match the pinned size and SHA-256. Restore unmodified access to the pinned asset and retry.",
          );
        return bytes;
      } catch (cause) {
        if (cause instanceof EvidenceParserError) throw cause;
        failure = cause;
      } finally {
        clearTimeout(timer);
      }
    }
    signal.throwIfAborted();
    throw new EvidenceParserError(
      "asset-download",
      grammar.id,
      `Cannot download the pinned parser after ${attempts} attempts. Restore network access to ${grammar.wasm.url} and retry; verified cached parsers work offline.`,
      undefined,
      { cause: failure },
    );
  }
}

/**
 * Selects the explicit, environment, or project-local cache root without
 * creating it.
 *
 * Acquisition owns directory creation so resolving a location never changes the
 * project cache as a side effect.
 */
function cacheDirectory(override: string | undefined): string {
  const configured = override ?? process.env["Evidence_CACHE_DIR"];
  if (configured !== undefined) {
    if (!path.isAbsolute(configured))
      throw new EvidenceParserError(
        "asset-cache",
        configured,
        "Evidence_CACHE_DIR must be an absolute writable directory.",
      );
    return path.normalize(configured);
  }
  return path.join(process.cwd(), "node_modules", ".cache", "evidence");
}

/**
 * Reads a cache file only when its size and SHA-256 match pinned provenance.
 *
 * Checking metadata first avoids loading a corrupted or unexpectedly large file
 * before immutable-asset validation.
 */
async function verified(
  file: string,
  asset: IEvidenceGrammarAsset,
): Promise<Uint8Array | undefined> {
  try {
    if ((await stat(file)).size !== asset.size) return undefined;
    const bytes = await readFile(file);
    return matches(bytes, asset) ? bytes : undefined;
  } catch (cause) {
    if (fileError(cause, "ENOENT")) return undefined;
    throw cause;
  }
}

/**
 * Verifies immutable bytes against the exact declared size and digest.
 *
 * Response headers cannot establish grammar provenance, so this comparison is
 * the shared trust boundary for cached and downloaded data.
 */
function matches(bytes: Uint8Array, asset: IEvidenceGrammarAsset): boolean {
  return (
    bytes.length === asset.size &&
    createHash("sha256").update(bytes).digest("hex") === asset.sha256
  );
}

/**
 * Streams a response with a byte cap so a bad server cannot exhaust the process
 * before validation.
 *
 * The reader is always released, including when the advertised asset is too
 * large or the stream ends unexpectedly.
 */
async function boundedBody(
  response: Response,
  size: number,
): Promise<Uint8Array> {
  if (response.body === null)
    throw new Error("The parser response has no body.");
  const reader: ReadableStreamDefaultReader<Uint8Array> =
    response.body.getReader();
  const output = new Uint8Array(size);
  let length = 0;
  try {
    for (;;) {
      const part: ReadableStreamReadResult<Uint8Array> = await reader.read();
      if (part.done !== false) break;
      if (length + part.value.length > size)
        throw new EvidenceParserError(
          "asset-corrupt",
          "parser download",
          "The parser response exceeds its pinned size.",
        );
      output.set(part.value, length);
      length += part.value.length;
    }
    return output.subarray(0, length);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/**
 * Races a shared transfer against one caller's cancellation without cancelling
 * peers.
 *
 * Other parser sessions may still consume the same destination promise, so a
 * single abort cannot own the shared controller.
 */
async function consume(
  promise: Promise<Uint8Array>,
  signal: AbortSignal | undefined,
): Promise<Uint8Array> {
  if (signal === undefined) return promise;
  let cancel: (() => void) | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        cancel = function abort(): void {
          reject(new Error("Parser preparation was cancelled."));
        };
        signal.addEventListener("abort", cancel, { once: true });
        if (signal.aborted) cancel();
      }),
    ]);
  } finally {
    if (cancel !== undefined) signal.removeEventListener("abort", cancel);
  }
}

/**
 * Narrows expected filesystem error codes used for cache recovery decisions.
 *
 * Unknown thrown values remain non-matches and are propagated by the caller.
 */
function fileError(cause: unknown, code: string): boolean {
  return cause instanceof Error && "code" in cause && cause.code === code;
}

/**
 * Reads and validates lock ownership, treating malformed locks as recoverable
 * stale state.
 *
 * Incomplete writes flow into age-based recovery instead of being trusted as a
 * live owner.
 */
async function readLock(
  file: string,
): Promise<IEvidenceTreeSitterAssetLock | undefined> {
  try {
    const parsed = typia.json.validateParse<IEvidenceTreeSitterAssetLock>(
      await readFile(file, "utf8"),
    );
    return parsed.success ? parsed.data : undefined;
  } catch (cause) {
    if (fileError(cause, "ENOENT")) return undefined;
    throw cause;
  }
}

/**
 * Removes only stale lock files after checking owner liveness and acquisition
 * age.
 *
 * A live process keeps its lock regardless of age, preventing one slow download
 * from being replaced by a competing acquisition.
 */
async function recoverLock(file: string): Promise<void> {
  const owner = await readLock(file);
  if (owner !== undefined) {
    try {
      process.kill(owner.pid, 0);
      return;
    } catch (cause) {
      if (!fileError(cause, "ESRCH")) return;
    }
    if ((await readLock(file))?.token !== owner.token) return;
  } else {
    try {
      if (Date.now() - (await stat(file)).mtimeMs < 120_000) return;
    } catch (cause) {
      if (fileError(cause, "ENOENT")) return;
      throw cause;
    }
  }
  await rm(file, { force: true });
}
