/** Observable resource ownership; grammar IDs report this instance's completed lazy loads. */
export interface IEvidenceParserState {
  active: number;
  waiting: number;
  languages: string[];
  closed: boolean;
}
