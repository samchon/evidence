/** One semantic declaration position to which a JSDoc block may attach. */
export interface ITypeScriptCommentAttachment {
  positionId?: string;
  siteId: string;
  unitId: string;
  /** Constructor documentation can withdraw parameter properties but cannot claim evidence. */
  withdrawalOnly?: boolean;
}
