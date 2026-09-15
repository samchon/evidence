import { EvidenceRubyAdapter } from "@wrtnlabs/evidence";
import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceTestSourceSnapshot } from "../../internal/EvidenceTestSourceSnapshot";

/**
 * Keeps detectable Ruby metaprogramming and unknown ownership incomplete.
 *
 * Dynamic surfaces must not produce a smaller public inventory.
 *
 * 1. Analyze dynamic directives, generated constants, unknown singleton owners,
 *    conditional declarations, and malformed source.
 * 2. Require each analysis to be incomplete with its corresponding diagnostic.
 * 3. Simulate an unreadable selected source and require its source failure to
 *    remain in the Ruby inventory.
 */
export async function test_ruby_failures(): Promise<void> {
  const dynamic = await new EvidenceRubyAdapter().analyze(
    EvidenceTestSourceSnapshot.create(
      "lib/dynamic.rb",
      dedent`
        module Dynamic
          define_method(name) { }
          define_singleton_method(:generated) { }
          include Shared
          prepend Ordered
          extend ClassMethods
          class_eval { def evaluated; end }
          const_set(:VALUE, 1)
          attr_reader attribute_name
          public method_name
          alias missing_alias missing_target

          if enabled?
            def conditional; end
          end
        end

        class InvalidModuleFunction
          module_function
        end

        class InvalidClassVisibility
          class << self
            def remains_public; end
            private_class_method :remains_public
          end
        end

        Generated = Class.new
        class Missing::Child; end
        def object.dynamic; end
      `,
    ),
  );
  const codes = new Set(
    dynamic.diagnostics.map((diagnostic) => diagnostic.code),
  );

  TestValidator.equals("dynamic Ruby inventory", dynamic.complete, false);
  for (const code of [
    "ruby-alias-target",
    "ruby-class-visibility-owner",
    "ruby-conditional-surface",
    "ruby-container-owner",
    "ruby-dynamic-attribute",
    "ruby-dynamic-directive",
    "ruby-dynamic-surface",
    "ruby-generated-constant",
    "ruby-module-function-owner",
    "ruby-singleton-owner",
  ])
    TestValidator.predicate(`Ruby failure ${code}`, codes.has(code));

  const malformed = await new EvidenceRubyAdapter().analyze(
    EvidenceTestSourceSnapshot.create("lib/broken.rb", "module Broken\n"),
  );
  TestValidator.equals("malformed Ruby inventory", malformed.complete, false);
  TestValidator.predicate(
    "Ruby parse diagnostic",
    malformed.diagnostics.some(
      (diagnostic) => diagnostic.code === "ruby-parse-incomplete",
    ),
  );

  const sourceFailure = await new EvidenceRubyAdapter().analyze(
    EvidenceTestSourceSnapshot.fail(
      EvidenceTestSourceSnapshot.create("lib/source.rb", "VALUE = 1\n"),
      {
        code: "path-unreadable",
        path: "/project/lib/missing.rb",
        message: "Unable to read selected Ruby source.",
      },
    ),
  );
  TestValidator.equals(
    "failed Ruby source snapshot",
    sourceFailure.complete,
    false,
  );
  TestValidator.predicate(
    "Ruby source diagnostic",
    sourceFailure.diagnostics.some(
      (diagnostic) => diagnostic.code === "source-path-unreadable",
    ),
  );
}
