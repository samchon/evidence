import type { IEvidenceSourceAddress } from "./IEvidenceSourceAddress";

/** One physical UTF-8 file with every selected logical address retained. */
export interface IEvidenceSourceFile {
  /** Filesystem device/inode identity, falling back to realpath if unavailable. */
  id: string;

  /** Canonical path used to read the file. Hard links can share an id. */
  physicalPath: string;

  /** Decoded UTF-8 source, preserving line endings and any byte-order mark. */
  content: string;

  /** SHA-256 of the original bytes for cache invalidation, not review fingerprints. */
  digest: string;

  /** Selected aliases in deterministic path order. */
  addresses: IEvidenceSourceAddress[];
}
