import type { IEvidenceCheckContext } from "./contexts/IEvidenceCheckContext";
import { EvidenceConfigLoader } from "./loaders/EvidenceConfigLoader";
import { EvidenceCheckProgrammer } from "./programmers/EvidenceCheckProgrammer";
import type { IEvidenceCheckAnalysis } from "./structures/IEvidenceCheckAnalysis";
import type { IEvidenceCheckReport } from "./structures/IEvidenceCheckReport";
import type { IEvidenceConfigPlan } from "./structures/IEvidenceConfigPlan";

/**
 * Coordinates configuration loading, materialization, and graph evaluation.
 *
 * Each execution creates its own context, allowing one facade to be reused without retaining prior inventories or diagnostics.
 */
export class EvidenceChecker {
  /** Configuration location used by analyze and check operations. */
  private readonly configFile: string;

  /** Selects the configuration file, defaulting to evidence.config.ts. */
  public constructor(configFile: string = "evidence.config.ts") {
    this.configFile = configFile;
  }

  /** Reloads the configuration and produces a fresh materialized analysis. */
  public async analyze(): Promise<IEvidenceCheckAnalysis> {
    return this.evaluate(await EvidenceConfigLoader.plan(this.configFile));
  }

  /** Creates a checker facade for one configuration analysis. */
  public static async analyze(
    configFile: string = "evidence.config.ts",
  ): Promise<IEvidenceCheckAnalysis> {
    return new EvidenceChecker(configFile).analyze();
  }

  /** Executes a fresh analysis and returns its command report. */
  public async check(): Promise<IEvidenceCheckReport> {
    return (await this.analyze()).report;
  }

  /** Creates a checker facade for one configuration check. */
  public static async check(
    configFile: string = "evidence.config.ts",
  ): Promise<IEvidenceCheckReport> {
    return new EvidenceChecker(configFile).check();
  }

  /** Evaluates an owned copy of an explicitly supplied configuration plan. */
  public async evaluate(
    input: IEvidenceConfigPlan,
  ): Promise<IEvidenceCheckAnalysis> {
    const plan = structuredClone(input);
    const context: IEvidenceCheckContext = {
      plan,
      claims: await EvidenceCheckProgrammer.materialize(plan),
    };
    return EvidenceCheckProgrammer.evaluate(context);
  }

  /** Creates a checker facade for one explicitly supplied configuration plan. */
  public static async evaluate(
    input: IEvidenceConfigPlan,
  ): Promise<IEvidenceCheckAnalysis> {
    return new EvidenceChecker(input.configFile).evaluate(input);
  }
}
