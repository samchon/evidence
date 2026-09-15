import path from "node:path";
import type { IEvidQueryContext } from "../contexts/IEvidQueryContext";
import { EvidQueryProgrammer } from "../programmers/EvidQueryProgrammer";
import type { IEvidCheckAnalysis } from "../structures/IEvidCheckAnalysis";
import type { IEvidGraphReport } from "../structures/IEvidGraphReport";
import type { IEvidInspectReport } from "../structures/IEvidInspectReport";
import type { IEvidLanguagesReport } from "../structures/IEvidLanguagesReport";
import type { IEvidListReport } from "../structures/IEvidListReport";
import type { EvidArtifactType } from "../typings/EvidArtifactType";
import type { EvidSymbol } from "../typings/EvidSymbol";

/**
 * Provides queries over one owned analysis snapshot.
 *
 * Construction clones the supplied check analysis and captures an absolute base
 * directory for file-qualified target formatting. List, inspect, and graph queries
 * reuse population indexes without reevaluating configuration or extraction.
 * Returned reports are cloned so caller mutation cannot invalidate later queries.
 *
 * @example
 * const query: EvidQuery = new EvidQuery(analysis, process.cwd());
 * const list: IEvidListReport = query.list("typescript", "function");
 * const first: IEvidListReport["items"][number] | undefined = list.items[0];
 * if (first !== undefined) await query.inspect(first.target);
 */
export class EvidQuery {
  /**
   * Analysis snapshot, target base directory, and reusable population indexes.
   *
   * This context owns its input data; programmer results are cloned before leaving the facade.
   */
  private readonly context: IEvidQueryContext;

  /**
   * Captures an analysis snapshot and builds indexes for subsequent queries.
   *
   * The base directory is resolved immediately so later process cwd changes do
   * not redirect file-qualified inspection or target formatting.
   */
  public constructor(analysis: IEvidCheckAnalysis, cwd: string) {
    const snapshot = structuredClone(analysis);
    this.context = {
      analysis: snapshot,
      cwd: path.resolve(cwd),
      populations: EvidQueryProgrammer.populations(snapshot),
    };
  }

  /**
   * Lists selected identities and addressable ancestors with optional display filters.
   *
   * Language and kind restrict returned rows without changing the check's diagnostic
   * or success state. Aliases remain grouped under each population-qualified identity.
   */
  public list(
    language?: EvidArtifactType,
    kind?: EvidSymbol,
  ): IEvidListReport {
    return structuredClone(
      EvidQueryProgrammer.list(this.context, language, kind),
    );
  }

  /**
   * Lists targets through a newly owned query snapshot.
   *
   * Use an instance when several queries should share population indexes; this
   * convenience call captures and indexes the supplied analysis for one operation.
   */
  public static list(
    analysis: IEvidCheckAnalysis,
    cwd: string,
    language?: EvidArtifactType,
    kind?: EvidSymbol,
  ): IEvidListReport {
    return new EvidQuery(analysis, cwd).list(language, kind);
  }

  /**
   * Resolves a target and gathers its evidence context in applicable populations.
   *
   * File-qualified targets use the captured base directory. Artifact-specific
   * grammars retain their own addressing rules, and each population keeps an
   * independent resolution, obligation state, acknowledgements, and reviews.
   */
  public async inspect(target: string): Promise<IEvidInspectReport> {
    return structuredClone(
      await EvidQueryProgrammer.inspect(this.context, target),
    );
  }

  /**
   * Inspects one target through a newly captured analysis context.
   *
   * Input data is isolated before asynchronous resolution begins. Reuse an instance
   * when subsequent inspections should share its population indexes.
   */
  public static async inspect(
    analysis: IEvidCheckAnalysis,
    cwd: string,
    target: string,
  ): Promise<IEvidInspectReport> {
    return new EvidQuery(analysis, cwd).inspect(target);
  }

  /**
   * Exports independent obligation boundaries, nodes, acknowledgements, and reviews.
   *
   * EvidNode identities include their boundary so repeated populations retain separate
   * coverage. Reviews remain distinct relations and never become acknowledgement edges.
   */
  public graph(): IEvidGraphReport {
    return structuredClone(EvidQueryProgrammer.graph(this.context));
  }

  /**
   * Exports a graph through a newly owned query snapshot.
   *
   * The supplied base directory controls file-qualified target display; extraction
   * and evaluation results come entirely from the provided analysis.
   */
  public static graph(
    analysis: IEvidCheckAnalysis,
    cwd: string,
  ): IEvidGraphReport {
    return new EvidQuery(analysis, cwd).graph();
  }

  /**
   * Lists certified programming and database adapter capabilities.
   *
   * This metadata query requires no configuration, source scan, or grammar load and
   * excludes candidates that only have parsing metadata.
   */
  public static languages(): IEvidLanguagesReport {
    return EvidQueryProgrammer.languages();
  }
}
