import type { IEvidScalaDeclaration } from "./IEvidScalaDeclaration";

/**
 * Represents a Scala forwarding declaration awaiting source-member resolution.
 *
 * The scanner preserves the forwarder's host and site first, then resolves the
 * requested source member through lexical paths during export materialization.
 */
export interface IEvidScalaExport {
  /**
   * Holds the forwarding declaration and its original extraction metadata.
   *
   * Its site remains the public declaration site even when the target is
   * declared in another object or file.
   */
  declaration: IEvidScalaDeclaration;

  /**
   * Lists lexical paths at which the source singleton can be found.
   *
   * Each path is tried in declaration context because relative Scala references
   * can resolve through nested owners.
   */
  paths: string[][];

  /**
   * Names the literal member requested from the resolved source object.
   *
   * Dynamic or computed exports are excluded before this record is created.
   */
  member: string;
}
