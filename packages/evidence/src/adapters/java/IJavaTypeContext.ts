import type { JavaTypeKind } from "./JavaTypeKind";

/**
 * Carries an enclosing Java type's state while its nested declarations are scanned.
 *
 * JavaFileScanner passes this context through type bodies so descendants retain
 * their structural identity, public address prefix, and inherited visibility.
 */
export interface IJavaTypeContext {
  /**
   * Enclosing type's scanner-local declaration record.
   *
   * Nested members use it to retain their structural owner.
   */
  declarationId: string;

  /**
   * Semantic path inherited by nested declarations.
   *
   * It determines unit identity rather than public file qualification.
   */
  identity: string[];

  /**
   * Public accessor prefix inherited from the enclosing type.
   *
   * Java members extend it when publishing targetable addresses.
   */
  address: string[];

  /**
   * Type form that determines supported nested declaration treatment.
   *
   * The scanner preserves this classification while walking members.
   */
  kind: JavaTypeKind;

  /**
   * Whether this owner exposes nested declarations through public API.
   *
   * Non-public ancestry suppresses child publication even if a child is public.
   */
  public: boolean;
}
