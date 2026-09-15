import { EvidenceCAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Keeps C declaration families inside the selected physical file boundary.
 *
 * C declarations sharing a spelling across files must not merge into one
 * semantic unit merely because their syntax is compatible.
 *
 * 1. Analyze selected C sources containing related declaration and definition
 *    forms.
 * 2. Compare the identities and sites within each physical source boundary.
 * 3. Require declarations from different files to remain distinct.
 */
export async function test_c_boundaries(): Promise<void> {
  const inventory = await new EvidenceCAdapter().analyze(
    EvidenceTestSourceSnapshot.combine([
      EvidenceTestSourceSnapshot.create(
        "include/contracts.h",
        dedent`
          #ifndef CONTRACTS_H
          #define CONTRACTS_H

          #include "cycle.h"

          struct Contract;
          struct Contract {
              int value;
          };

          int run(int value);
          int run(int value);

          #endif
        ` + "\n",
      ),
      EvidenceTestSourceSnapshot.create(
        "include/cycle.h",
        dedent`
          #pragma once
          #include "contracts.h"
        ` + "\n",
      ),
      EvidenceTestSourceSnapshot.create(
        "src/contracts.c",
        dedent`
          #include "../include/contracts.h"

          struct Contract {
              int value;
          };

          int run(int value) {
              return value;
          }
        ` + "\n",
      ),
    ]),
  );

  TestValidator.equals("complete C file boundaries", inventory.diagnostics, []);

  // A forward declaration and definition merge inside the header.
  const headerTypes = inventory.units.filter(
    (unit) =>
      unit.identity.join(".") === "struct Contract" &&
      unit.sites.some((site) => site.file.endsWith("/include/contracts.h")),
  );
  TestValidator.equals("header C tag family", headerTypes.length, 1);
  const headerType = headerTypes[0];
  if (headerType === undefined) throw new Error("Missing header C tag family.");
  TestValidator.equals(
    "C forward and definition sites",
    headerType.sites.length,
    2,
  );

  const headerFunctions = inventory.units.filter(
    (unit) =>
      unit.identity.join(".") === "run" &&
      unit.sites.some((site) => site.file.endsWith("/include/contracts.h")),
  );
  TestValidator.equals("header C function family", headerFunctions.length, 1);
  const headerFunction = headerFunctions[0];
  if (headerFunction === undefined)
    throw new Error("Missing header C function family.");
  TestValidator.equals(
    "repeated C prototype sites",
    headerFunction.sites.length,
    2,
  );

  // Header and source declarations retain separate semantic IDs.
  TestValidator.equals(
    "separate C type file identities",
    new Set(
      inventory.units
        .filter((unit) => unit.identity.join(".") === "struct Contract")
        .map((unit) => unit.id),
    ).size,
    2,
  );
  TestValidator.equals(
    "separate C function file identities",
    new Set(
      inventory.units
        .filter((unit) => unit.identity.join(".") === "run")
        .map((unit) => unit.id),
    ).size,
    2,
  );
}
