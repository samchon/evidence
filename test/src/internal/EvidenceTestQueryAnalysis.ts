import { EvidenceChecker } from "evidence";
import type {
  IEvidenceCheckAnalysis,
  IEvidenceConfigPlan,
  IEvidenceConfigPlanReference,
} from "evidence";
import { dedent } from "@typia/utils";
import { join } from "node:path";

/** Builds the shared query-command graph from real TypeScript extraction. */
export namespace EvidenceTestQueryAnalysis {
  export function records(): Record<string, string> {
    return {
      "Evidence.config.ts": dedent`
        export default {
          severity: "error",
          claims: [
            {
              name: "implementation",
              type: "typescript",
              files: ["src/**/*.ts"],
              symbol: "function",
              reference: {
                type: "typescript",
                files: ["contracts/**/*.ts"],
                symbol: "property",
                requireReview: true,
              },
            },
          ],
        };
      `,
      "contracts/shared.ts": dedent`
        /** Shared contract. */
        export interface Contract {
          /** Literal contract member. */
          "member.with.dots": string;
          child: number;
        }
      `,
      "contracts/other.ts": dedent`
        export interface Contract {
          "member.with.dots": number;
        }
      `,
      "contracts/index.ts": dedent`
        export { Contract as Renamed } from "./shared";
      `,
      "src/implementation.ts": dedent`
        /**
         * @Evidence ../contracts/shared.ts#Contract["member.with.dots"] Implements the shared contract.
         * @EvidenceExclude ../contracts/other.ts#Contract["member.with.dots"] The numeric variant is intentionally separate.
         * @EvidenceReview ../contracts/shared.ts#Contract["member.with.dots"] #0000000 Reviewed the previous contract.
         */
        export function implementation(): void {}
      `,
    };
  }

  export async function analyze(
    directory: string,
    referenceCount: number = 1,
  ): Promise<IEvidenceCheckAnalysis> {
    return EvidenceChecker.evaluate(plan(directory, referenceCount));
  }
}

function plan(directory: string, referenceCount: number): IEvidenceConfigPlan {
  const references = Array.from({ length: referenceCount }, (_, index) =>
    reference(index + 4),
  );
  return {
    configFile: join(directory, "Evidence.config.ts"),
    claims: [
      {
        index: 2,
        population: {
          name: "implementation",
          type: "typescript",
          files: ["src/**/*.ts"],
          symbol: "function",
          reference: references.map((entry) => entry.population),
        },
        severity: "error",
        symbols: ["function"],
        references,
      },
    ],
  };
}

function reference(index: number): IEvidenceConfigPlanReference {
  return {
    index,
    population: {
      type: "typescript",
      files: ["contracts/**/*.ts"],
      symbol: "property",
      requireReview: true,
    },
    severity: "error",
    symbols: ["property"],
  };
}
