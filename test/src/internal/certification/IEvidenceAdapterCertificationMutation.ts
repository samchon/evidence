/** Text edits that distinguish annotation metadata from semantic source content. */
export interface IEvidenceAdapterCertificationMutation {
  unit: string;
  reasonBefore: string;
  reasonAfter: string;
  contentBefore: string;
  contentAfter: string;
}
