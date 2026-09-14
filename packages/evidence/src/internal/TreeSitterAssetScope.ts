import { AsyncLocalStorage } from "node:async_hooks";

import type { ITreeSitterAssetOptions } from "./ITreeSitterAssetOptions";

/**
 * Carries parser-asset controls through one asynchronous execution chain.
 *
 * Async-local inheritance lets nested checker and adapter instances share a
 * caller's cache, cancellation, and progress policy without global mutable options.
 */
export namespace TreeSitterAssetScope {
  /**
   * Returns a defensive copy of the current asset controls, or an empty default outside a scope.
   *
   * TreeSitterAssets merges this result with constructor options so callers cannot
   * mutate async-local state through the returned object.
   */
  export function current(): ITreeSitterAssetOptions {
    return { ...storage.getStore() };
  }

  /**
   * Runs work with inherited asset controls overridden for its asynchronous chain.
   *
   * Nested parser construction inherits the merged controls, while sibling tasks
   * continue to observe the parent scope unchanged.
   */
  export function run<T>(
    options: ITreeSitterAssetOptions,
    closure: () => T,
  ): T {
    return storage.run({ ...current(), ...options }, closure);
  }

  /**
   * Stores asset controls for the active asynchronous execution chain.
   *
   * This module-level storage carries policy only; importing the scope does not
   * initialize parsers or access the filesystem.
   */
  const storage = new AsyncLocalStorage<ITreeSitterAssetOptions>();
}
