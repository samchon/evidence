import { AsyncLocalStorage } from "node:async_hooks";

import type { ITreeSitterAssetOptions } from "./ITreeSitterAssetOptions";

/** Carries acquisition controls through independently owned checker and adapter instances. */
export namespace TreeSitterAssetScope {
  /** Reads the current execution's controls without sharing mutable state across checks. */
  export function current(): ITreeSitterAssetOptions {
    return { ...storage.getStore() };
  }

  /** Runs an operation with inherited controls and explicit local overrides. */
  export function run<T>(
    options: ITreeSitterAssetOptions,
    closure: () => T,
  ): T {
    return storage.run({ ...current(), ...options }, closure);
  }

  /** Async execution state; importing this module performs no parser or filesystem work. */
  const storage = new AsyncLocalStorage<ITreeSitterAssetOptions>();
}
