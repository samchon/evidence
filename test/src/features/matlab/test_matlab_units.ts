import { EvidenceInventory, EvidenceMatlabAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Verifies the public denominator, class metadata, accessors, and local function boundaries. */
export async function test_matlab_units(): Promise<void> {
  const inventory = await new EvidenceMatlabAdapter().analyze(
    TestSourceSnapshot.combine([
      TestSourceSnapshot.create(
        "src/Contract.m",
        dedent`
      classdef (Hidden) Contract < handle
        % Public even when Hidden metadata is present.
        properties
          documented % Public value help.
          undocumented
        end
        properties (Access=private)
          secret
        end
        properties (Access=protected)
          protectedValue
        end
        properties (GetAccess=public, SetAccess=private)
          readable
        end
        properties (GetAccess=private, SetAccess=public)
          writable
        end
        properties (Access={?Friend, ?pkg.Other})
          friendOnly
        end
        properties (Constant)
          constant = 1
        end
        properties (Dependent)
          derived
        end
        methods
          function obj = Contract()
          end
          function run(obj)
          end
          function value = get.derived(obj)
            value = 1;
          end
          function obj = set.derived(obj, value)
          end
        end
        methods (Static)
          function create()
          end
        end
        methods (Access=private)
          function hidden(obj)
          end
        end
        methods (Abstract)
          perform(obj)
        end
        enumeration
          Ready
        end
        events
          Changed
        end
        events (ListenAccess=private, NotifyAccess=private)
          SecretChanged
        end
      end
      function local()
      end
    `.concat("\n"),
        ["src/Contract.m", "alias/Contract.m"],
      ),
      TestSourceSnapshot.create(
        "src/main.m",
        dedent`
      function value = main()
        value = 1;
        function nested()
        end
      end
      function helper()
      end
    `.concat("\n"),
      ),
      TestSourceSnapshot.create(
        "src/private/secret.m",
        "function secret()\nend\n",
      ),
    ]),
  );

  TestValidator.equals("complete MATLAB inventory", inventory.diagnostics, []);
  TestValidator.equals(
    "exact source declarations",
    inventory.units
      .map((unit) => `${unit.symbol}:${unit.identity.join(".")}`)
      .sort((left, right) => left.localeCompare(right)),
    [
      "type:Contract",
      "property:Contract.documented",
      "property:Contract.undocumented",
      "property:Contract.readable",
      "property:Contract.writable",
      "property:Contract.constant",
      "property:Contract.derived",
      "function:Contract.Contract",
      "function:Contract.run",
      "function:Contract.create",
      "function:Contract.perform",
      "property:Contract.Ready",
      "property:Contract.Changed",
      "function:main",
    ].sort((left, right) => left.localeCompare(right)),
  );
  const derived = inventory.units.find((unit) => unit.name === "derived");
  TestValidator.equals(
    "property accessors share one property",
    derived?.sites?.length,
    3,
  );
  TestValidator.equals(
    "no synthetic accessor functions",
    inventory.units.some(
      (unit) => unit.symbol === "function" && unit.name === "derived",
    ),
    false,
  );
  const contract = inventory.units.find(
    (unit) => unit.name === "Contract" && unit.symbol === "type",
  );
  TestValidator.predicate(
    "explicit ownership",
    inventory.units
      .filter((unit) => unit.identity.length === 2)
      .every((unit) => unit.parentId === contract?.id),
  );
  TestValidator.equals(
    "all undocumented sites remain hosts",
    inventory.hosts.length,
    inventory.units.reduce((count, unit) => count + unit.sites.length, 0),
  );
  const graph = new EvidenceInventory([inventory]);
  TestValidator.equals(
    "logical alias",
    graph.resolve(
      {
        file: "/project/alias/Contract.m",
        segments: ["Contract", "undocumented"],
      },
      inventory.units.map((unit) => unit.id),
    ).status,
    "resolved",
  );
}
