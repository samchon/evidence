import path from "node:path";
import type { IEvidenceQueryContext } from "../contexts/IEvidenceQueryContext";
import { EvidenceQueryProgrammer } from "../programmers/EvidenceQueryProgrammer";
import type { IEvidenceCheckAnalysis } from "../structures/IEvidenceCheckAnalysis";
import type { IEvidenceGraphReport } from "../structures/IEvidenceGraphReport";
import type { IEvidenceInspectReport } from "../structures/IEvidenceInspectReport";
import type { IEvidenceLanguagesReport } from "../structures/IEvidenceLanguagesReport";
import type { IEvidenceListReport } from "../structures/IEvidenceListReport";
import type { EvidenceArtifactType } from "../typings/EvidenceArtifactType";
import type { EvidenceSymbol } from "../typings/EvidenceSymbol";

/**
 * Provides queries over one owned analysis snapshot.
 *
 * Population indexes are shared across operations. Input and returned reports are isolated so callers cannot invalidate the context.
 */
export class EvidenceQuery {
  /** Analysis, target base directory, and population indexes owned by this facade. */
  private readonly context: IEvidenceQueryContext;

  /** Captures the analysis and builds the indexes used by subsequent queries. */
  public constructor(analysis: IEvidenceCheckAnalysis, cwd: string) {
    const snapshot = structuredClone(analysis);
    this.context = {
      analysis: snapshot,
      cwd: path.resolve(cwd),
      populations: EvidenceQueryProgrammer.populations(snapshot),
    };
  }

  /** Lists selected identities and their addressable ancestors from this snapshot. */
  public list(
    language?: EvidenceArtifactType,
    kind?: EvidenceSymbol,
  ): IEvidenceListReport {
    return structuredClone(
      EvidenceQueryProgrammer.list(this.context, language, kind),
    );
  }

  /** Creates a query facade for a single list operation. */
  public static list(
    analysis: IEvidenceCheckAnalysis,
    cwd: string,
    language?: EvidenceArtifactType,
    kind?: EvidenceSymbol,
  ): IEvidenceListReport {
    return new EvidenceQuery(analysis, cwd).list(language, kind);
  }

  /** Resolves a target relative to this facade's base directory. */
  public async inspect(target: string): Promise<IEvidenceInspectReport> {
    return structuredClone(
      await EvidenceQueryProgrammer.inspect(this.context, target),
    );
  }

  /** Creates a query facade for a single target inspection. */
  public static async inspect(
    analysis: IEvidenceCheckAnalysis,
    cwd: string,
    target: string,
  ): Promise<IEvidenceInspectReport> {
    return new EvidenceQuery(analysis, cwd).inspect(target);
  }

  /** Exports the snapshot's independent obligation boundaries and graph edges. */
  public graph(): IEvidenceGraphReport {
    return structuredClone(EvidenceQueryProgrammer.graph(this.context));
  }

  /** Creates a query facade for a single graph export. */
  public static graph(
    analysis: IEvidenceCheckAnalysis,
    cwd: string,
  ): IEvidenceGraphReport {
    return new EvidenceQuery(analysis, cwd).graph();
  }

  /** Lists registered language capabilities without loading a project analysis. */
  public static languages(): IEvidenceLanguagesReport {
    return EvidenceQueryProgrammer.languages();
  }
}
