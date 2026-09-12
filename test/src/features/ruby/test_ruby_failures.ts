import { TestValidator } from "@nestia/e2e";
import { dedent } from "@typia/utils";

import { EvidenceRubyAdapter } from "../../../../packages/evidence/src/EvidenceRubyAdapter";
import { TestSourceSnapshot } from "../../internal/TestSourceSnapshot";

/** Keeps detectable Ruby metaprogramming and unresolved ownership incomplete. */
export async function test_ruby_failures(): Promise<void> {
  const dynamic = await new EvidenceRubyAdapter().analyze(
    TestSourceSnapshot.create(
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
    TestSourceSnapshot.create("lib/broken.rb", "module Broken\n"),
  );
  TestValidator.equals("malformed Ruby inventory", malformed.complete, false);
  TestValidator.predicate(
    "Ruby parse diagnostic",
    malformed.diagnostics.some(
      (diagnostic) => diagnostic.code === "ruby-parse-incomplete",
    ),
  );

  const sourceFailure = await new EvidenceRubyAdapter().analyze(
    TestSourceSnapshot.fail(
      TestSourceSnapshot.create("lib/source.rb", "VALUE = 1\n"),
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
