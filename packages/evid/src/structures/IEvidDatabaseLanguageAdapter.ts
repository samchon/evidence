import type { EvidDatabaseSymbol } from "../typings/EvidDatabaseSymbol";

/**
 * Certified schema and documentation boundaries of a database adapter.
 *
 * This contract describes the units an adapter can extract and how citations name
 * them. Capability reports keep these semantic guarantees separate from the
 * grammar's ability to recognize a broader range of database syntax.
 */
export interface IEvidDatabaseLanguageAdapter {
  /**
   * Public constructor exposing this schema adapter.
   *
   * Programmatic consumers can connect the catalog entry to its extraction API.
   */
  entry: string;

  /**
   * Database symbol selectors supported by the adapter.
   *
   * These determine which extracted models, columns, or relations can be selected.
   */
  symbols: EvidDatabaseSymbol[];

  /**
   * Schema declarations included in the certified extraction surface.
   *
   * This qualifies grammar support with the semantic boundaries needed for a
   * complete Evid inventory.
   */
  publicSurface: string;

  /**
   * Canonical qualification used to address extracted schema units.
   *
   * Authors follow this policy when spelling model, column, or relation targets.
   */
  addressing: string;

  /**
   * Documentation forms accepted at supported schema declaration positions.
   *
   * Attachment rules determine which comments can carry evidence or withdrawal tags.
   */
  comments: string[];

  /**
   * Known schema capabilities outside certified extraction.
   *
   * Capability readers use these limitations when judging whether their input
   * falls within the adapter's documented surface.
   */
  unsupported: string[];
}
