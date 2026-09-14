import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceCAdapter } from "../../../../packages/evidence/src/adapters/c/EvidenceCAdapter";
import type { EvidenceTargetResolutionStatus } from "../../../../packages/evidence/src/typings/EvidenceTargetResolutionStatus";
import { TestGraph } from "../../internal/TestGraph";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

interface ICTargetStatus {
  target: string | undefined;
  status: EvidenceTargetResolutionStatus;
}

/** Resolves exact C tag names, ordinary aliases, and aggregate members. */
export async function test_c_targets(): Promise<void> {
  const adapter = new EvidenceCAdapter();
  const reference = await adapter.analyze(
    TestSourceSnapshot.create(
      "include/models.h",
      dedent`
        typedef struct Sale {
            int total;
        } Sale;

        union Payload {
            int number;
        };

        struct Later {
            int value;
        };
        typedef struct Later Later;

        struct Collision {
            int member;
        };
        extern int Collision;
      `,
    ),
  );
  const claim = await adapter.analyze(
    TestSourceSnapshot.create(
      "test/verify.c",
      dedent`
        /**
         * @evidence ../include/models.h#["struct Sale"] Verifies the exact tag.
         * @evidence ../include/models.h#Sale Verifies the typedef alias.
         * @evidence ../include/models.h#Sale.total Verifies its field.
         * @evidence ../include/models.h#Payload Verifies a safe tag alias.
         * @evidence ../include/models.h#Payload.number Verifies its field alias.
         * @evidence ../include/models.h#Later.value Verifies a typedef declared after its tag definition.
         * @evidence ../include/models.h#["struct Collision"] Verifies the exact colliding tag.
         * @evidence ../include/models.h#["struct Collision"].member Verifies its exact field.
         * @evidence ../include/models.h#Collision Verifies the ordinary object.
         * @evidence ../include/models.h#Collision.member Cannot cross into a suppressed tag alias.
         */
        void verify(void) {}
      `,
    ),
  );

  TestValidator.equals(
    "complete C target reference",
    reference.diagnostics,
    [],
  );
  TestValidator.equals("complete C target claim", claim.diagnostics, []);
  const resolutions = await TestGraph.resolveDeclarations(
    claim,
    reference,
    reference.units.map((unit) => unit.id),
  );
  TestValidator.equals(
    "C target statuses",
    resolutions
      .map((resolution) => ({
        target: claim.declarations.find(
          (declaration) => declaration.id === resolution.declarationId,
        )?.target,
        status: resolution.resolution.status,
      }))
      .sort(compareTarget),
    (<ICTargetStatus[]>[
      {
        target: '../include/models.h#["struct Collision"]',
        status: "resolved",
      },
      {
        target: '../include/models.h#["struct Collision"].member',
        status: "resolved",
      },
      { target: '../include/models.h#["struct Sale"]', status: "resolved" },
      { target: "../include/models.h#Collision", status: "resolved" },
      {
        target: "../include/models.h#Collision.member",
        status: "missing-member",
      },
      { target: "../include/models.h#Later.value", status: "resolved" },
      { target: "../include/models.h#Payload", status: "resolved" },
      { target: "../include/models.h#Payload.number", status: "resolved" },
      { target: "../include/models.h#Sale", status: "resolved" },
      { target: "../include/models.h#Sale.total", status: "resolved" },
    ]).sort(compareTarget),
  );
}

function compareTarget(left: ICTargetStatus, right: ICTargetStatus): number {
  return compare(left.target ?? "", right.target ?? "");
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
