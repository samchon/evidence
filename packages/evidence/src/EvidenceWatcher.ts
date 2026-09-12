import path from "node:path";
import typia from "typia";

import { ConfigDependencyScanner } from "./internal/ConfigDependencyScanner";
import type { IConfigDependencyScan } from "./internal/IConfigDependencyScan";
import type { IEvidenceWatchAttempt } from "./internal/IEvidenceWatchAttempt";
import { SourcePath } from "./internal/SourcePath";
import { WatchDependencySet } from "./internal/WatchDependencySet";
import { WatchDependencySnapshot } from "./internal/WatchDependencySnapshot";
import type { IEvidenceCheckAnalysis } from "./structures/IEvidenceCheckAnalysis";
import type { IEvidenceSourceDependency } from "./structures/IEvidenceSourceDependency";
import type { IEvidenceWatchCheckCycle } from "./structures/IEvidenceWatchCheckCycle";
import type { IEvidenceWatchFailureCycle } from "./structures/IEvidenceWatchFailureCycle";
import type { IEvidenceWatchOptions } from "./structures/IEvidenceWatchOptions";
import type { EvidenceWatchPublisher } from "./typings/EvidenceWatchPublisher";
import { EvidenceChecker } from "./EvidenceChecker";

/** Publishes serialized fresh checks whenever an active filesystem dependency changes. */
export class EvidenceWatcher {
  private readonly configFile: string;
  private readonly pollIntervalMilliseconds: number;
  private readonly debounceMilliseconds: number;
  private active: IEvidenceSourceDependency[];
  private started = false;
  private closed = false;
  private wake: (() => void) | undefined;
  private cycles = 0;

  public constructor(
    configFile: string = "evidence.config.ts",
    options: IEvidenceWatchOptions = {},
  ) {
    const checked = typia.assert(options);
    this.configFile = path.resolve(configFile);
    this.pollIntervalMilliseconds = checked.pollIntervalMilliseconds ?? 250;
    this.debounceMilliseconds = checked.debounceMilliseconds ?? 100;
    this.active = configurationFallback(this.configFile);
  }

  /** Returns an independent snapshot of the paths that can trigger the next cycle. */
  public dependencies(): IEvidenceSourceDependency[] {
    return structuredClone(this.active);
  }

  /** Runs the initial check, then waits until close while publishing stable cycles in order. */
  public async watch(publish: EvidenceWatchPublisher): Promise<void> {
    if (this.started)
      throw new Error("An Evidence watcher can be started only once.");
    if (this.closed)
      throw new Error("A closed Evidence watcher cannot be started.");
    this.started = true;

    try {
      let attempt = await this.evaluateStable();
      if (this.isClosed()) return;
      this.active = attempt.dependencies;
      this.cycles = attempt.cycle.cycle;
      await publish(attempt.cycle);
      let baseline = attempt.snapshot;

      while (!this.isClosed()) {
        await this.pause(this.pollIntervalMilliseconds);
        if (this.isClosed()) break;
        const changed = await WatchDependencySnapshot.capture(this.active);
        if (changed.equals(baseline)) continue;

        await this.settle(changed);
        if (this.isClosed()) break;
        attempt = await this.evaluateStable();
        if (this.isClosed()) break;
        this.active = attempt.dependencies;
        this.cycles = attempt.cycle.cycle;
        await publish(attempt.cycle);
        baseline = attempt.snapshot;
      }
    } finally {
      this.closed = true;
      this.wake = undefined;
    }
  }

  /** Requests shutdown and releases a pending delay without waiting for its full interval. */
  public async close(): Promise<void> {
    this.closed = true;
    this.wake?.();
  }

  private async evaluateStable(): Promise<IEvidenceWatchAttempt> {
    for (;;) {
      if (this.isClosed()) {
        const snapshot = await WatchDependencySnapshot.capture(this.active);
        return {
          cycle: failureCycle(
            this.cycles + 1,
            this.configFile,
            new Error("The Evidence watcher was closed."),
          ),
          dependencies: this.active,
          snapshot,
        };
      }
      const beforeConfig = await scanConfiguration(this.configFile);
      const candidates = WatchDependencySet.merge(
        this.active,
        beforeConfig.dependencies,
      );
      const before = await WatchDependencySnapshot.capture(candidates);

      let analysis: IEvidenceCheckAnalysis | undefined;
      let analysisCause: unknown;
      try {
        analysis = await EvidenceChecker.analyze(this.configFile);
      } catch (cause) {
        analysisCause = cause;
      }
      const afterConfig = await scanConfiguration(this.configFile);
      const scanCause = afterConfig.cause;
      const cause = analysisCause ?? scanCause;
      const active =
        analysis === undefined
          ? WatchDependencySet.merge(this.active, afterConfig.dependencies)
          : cause === undefined
            ? WatchDependencySet.analysis(analysis, afterConfig.dependencies)
            : WatchDependencySet.merge(
                this.active,
                afterConfig.dependencies,
                WatchDependencySet.analysis(analysis, []),
              );

      if (!WatchDependencySet.contains(candidates, active)) {
        this.active = active;
        continue;
      }
      const after = await WatchDependencySnapshot.capture(candidates);
      if (!before.equals(after)) {
        this.active = active;
        continue;
      }

      const number = this.cycles + 1;
      const cycle =
        analysis !== undefined && cause === undefined
          ? checkCycle(number, analysis)
          : failureCycle(number, this.configFile, cause);
      return {
        cycle,
        dependencies: active,
        snapshot: after.select(active),
      };
    }
  }

  private async settle(
    initial: WatchDependencySnapshot,
  ): Promise<WatchDependencySnapshot> {
    let previous = initial;
    while (!this.isClosed() && this.debounceMilliseconds !== 0) {
      await this.pause(this.debounceMilliseconds);
      if (this.isClosed()) return previous;
      const current = await WatchDependencySnapshot.capture(this.active);
      if (current.equals(previous)) return current;
      previous = current;
    }
    return previous;
  }

  private async pause(milliseconds: number): Promise<void> {
    if (this.isClosed()) return;
    await new Promise<undefined>((resolve) => {
      let settled = false;
      const complete = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.wake === complete) this.wake = undefined;
        resolve(undefined);
      };
      const timer = setTimeout(complete, milliseconds);
      this.wake = complete;
    });
  }

  private isClosed(): boolean {
    return this.closed;
  }
}

async function scanConfiguration(
  configFile: string,
): Promise<IConfigDependencyScan> {
  const scanner = new ConfigDependencyScanner(configFile);
  try {
    return { dependencies: await scanner.scan() };
  } catch (cause) {
    return { dependencies: scanner.list(), cause };
  }
}

function checkCycle(
  cycle: number,
  analysis: IEvidenceCheckAnalysis,
): IEvidenceWatchCheckCycle {
  return {
    schemaVersion: 1,
    command: "check",
    watch: true,
    cycle,
    status: analysis.report.status,
    success: analysis.report.success,
    exitCode: analysis.report.exitCode,
    report: analysis.report,
  };
}

function failureCycle(
  cycle: number,
  configFile: string,
  cause: unknown,
): IEvidenceWatchFailureCycle {
  return {
    schemaVersion: 1,
    command: "check",
    watch: true,
    cycle,
    status: "failed",
    success: false,
    exitCode: 2,
    configFile,
    message: cause instanceof Error ? cause.message : String(cause),
    repair:
      "Correct the current configuration, dependency, or source failure; the watcher will retry after the next filesystem change.",
  };
}

function configurationFallback(
  configFile: string,
): IEvidenceSourceDependency[] {
  const normalized = SourcePath.slash(configFile);
  return [
    { path: normalized, recursive: false },
    { path: SourcePath.slash(path.dirname(normalized)), recursive: true },
  ];
}
