import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { ReadableStreamReadResult } from "node:stream/web";
import { setTimeout as delay } from "node:timers/promises";
import typia from "typia";

import { EvidenceParserError } from "../parsers/EvidenceParserError";
import type { IEvidenceGrammar } from "../structures/IEvidenceGrammar";
import type { IEvidenceGrammarAsset } from "../structures/IEvidenceGrammarAsset";
import type { ITreeSitterAssetLock } from "./ITreeSitterAssetLock";
import type { ITreeSitterAssetOptions } from "./ITreeSitterAssetOptions";
import type { ITreeSitterAssetPending } from "./ITreeSitterAssetPending";

/** Acquires immutable upstream grammars and validates every cache read before loading WASM. */
export class TreeSitterAssetCache {
  /** Transfers shared across independent adapter/parser instances. */
  private static readonly pending = new Map<string, ITreeSitterAssetPending>();

  /** Captures execution-local controls without performing filesystem or network work. */
  public constructor(private readonly options: ITreeSitterAssetOptions) {}

  /** Returns verified bytes, automatically repairing missing or damaged cache entries. */
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

      let pending = TreeSitterAssetCache.pending.get(destination);
      if (pending === undefined || pending.controller.signal.aborted) {
        const controller = new AbortController();
        pending = {
          controller,
          consumers: 0,
          promise: this.acquire(grammar, destination, controller.signal),
        };
        TreeSitterAssetCache.pending.set(destination, pending);
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
          if (TreeSitterAssetCache.pending.get(destination) === pending)
            TreeSitterAssetCache.pending.delete(destination);
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
        "Cannot prepare the parser cache. Restore write access or set EVIDENCE_CACHE_DIR to an absolute writable directory.",
        undefined,
        { cause },
      );
    }
  }

  /** Coordinates publication across processes and cleans up only this attempt's files. */
  private async acquire(
    grammar: IEvidenceGrammar,
    destination: string,
    signal: AbortSignal,
  ): Promise<Uint8Array> {
    await mkdir(path.dirname(destination), { recursive: true });
    const lock = `${destination}.lock`;
    const owner: ITreeSitterAssetLock = {
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

  /** Downloads the pinned URL with finite attempts, a body deadline, and an exact size bound. */
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

/** Resolves platform cache conventions without writing to node_modules or the source project. */
function cacheDirectory(override: string | undefined): string {
  const configured = override ?? process.env["EVIDENCE_CACHE_DIR"];
  if (configured !== undefined) {
    if (!path.isAbsolute(configured))
      throw new EvidenceParserError(
        "asset-cache",
        configured,
        "EVIDENCE_CACHE_DIR must be an absolute writable directory.",
      );
    return path.normalize(configured);
  }
  if (process.platform === "win32")
    return path.join(
      process.env["LOCALAPPDATA"] ?? path.join(homedir(), "AppData", "Local"),
      "wrtnlabs",
      "evidence",
      "Cache",
    );
  if (process.platform === "darwin")
    return path.join(homedir(), "Library", "Caches", "wrtnlabs", "evidence");
  const xdg = process.env["XDG_CACHE_HOME"];
  return path.join(
    xdg !== undefined && path.isAbsolute(xdg)
      ? xdg
      : path.join(homedir(), ".cache"),
    "wrtnlabs",
    "evidence",
  );
}

/** Rejects oversized cache entries before reading their contents. */
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

/** Checks the complete immutable identity, independent of transport response headers. */
function matches(bytes: Uint8Array, asset: IEvidenceGrammarAsset): boolean {
  return (
    bytes.length === asset.size &&
    createHash("sha256").update(bytes).digest("hex") === asset.sha256
  );
}

/** Reads no more than the catalog's expected bytes and always releases the response stream. */
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

/** Waits for shared work while allowing one subscriber to stop independently. */
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

/** Recognizes a filesystem condition without assuming every thrown value is an errno object. */
function fileError(cause: unknown, code: string): boolean {
  return cause instanceof Error && "code" in cause && cause.code === code;
}

/** Reads a lock if present; incomplete lock writes use the age-based recovery path. */
async function readLock(
  file: string,
): Promise<ITreeSitterAssetLock | undefined> {
  try {
    const parsed = typia.json.validateParse<ITreeSitterAssetLock>(
      await readFile(file, "utf8"),
    );
    return parsed.success ? parsed.data : undefined;
  } catch (cause) {
    if (fileError(cause, "ENOENT")) return undefined;
    throw cause;
  }
}

/** Recovers dead owners and old partial lock writes; live owners are never evicted by age. */
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
