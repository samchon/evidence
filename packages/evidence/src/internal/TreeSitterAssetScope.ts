import { AsyncLocalStorage } from "node:async_hooks";

import type { ITreeSitterAssetOptions } from "./ITreeSitterAssetOptions";

/**
 * Carries parser-asset controls through one asynchronous execution chain.
 *
 * Async-local inheritance lets nested checker and adapter instances share a
 * caller's cache, cancellation, and progress policy without global mutable options.
 */
export namespace TreeSitterAssetScope {
  /** Reads a defensive copy of the current execution controls, or an empty default outside a scope. */
  export function current(): ITreeSitterAssetOptions {
    return { ...storage.getStore() };
  }

  /** Runs work with inherited controls overridden locally, preserving parent state for sibling tasks. */
  export function run<T>(
    options: ITreeSitterAssetOptions,
    closure: () => T,
  ): T {
    return storage.run({ ...current(), ...options }, closure);
  }

  /** Async execution state; importing this module performs no parser or filesystem work. */
  const storage = new AsyncLocalStorage<ITreeSitterAssetOptions>();
}
