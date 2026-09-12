import type { RubyContainerKind } from "./RubyContainerKind";
import type { RubyMethodSide } from "./RubyMethodSide";
import type { RubyScopeKind } from "./RubyScopeKind";
import type { RubyVisibility } from "./RubyVisibility";

/** Mutable lexical state for one Ruby class, module, singleton, or top-level body. */
export interface IRubyScopeContext {
  kind: RubyScopeKind;
  identity: string[];
  side: RubyMethodSide;
  visibility: RubyVisibility;
  moduleFunction: boolean;
  containerKind?: RubyContainerKind;
}
