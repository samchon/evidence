/**
 * Point-in-time view of a parser runtime's admission and grammar state.
 *
 * This supports lifecycle inspection without allocating a parser or loading a
 * grammar. Closing prevents new admission before accepted work finishes, so a
 * closed runtime can temporarily retain active sessions and queued requests.
 */
export interface IEvidenceParserState {
  /**
   * Number of currently reserved parse slots.
   *
   * A reservation includes asynchronous extraction work until its callback
   * settles.
   */
  active: number;

  /**
   * Number of accepted requests waiting for an available slot.
   *
   * These requests remain eligible to run after close begins draining the
   * queue.
   */
  waiting: number;

  /**
   * Sorted grammar IDs successfully loaded by this runtime.
   *
   * Pending or failed acquisitions are absent, even if other runtimes have
   * loaded the same grammar into a process-wide cache.
   */
  languages: string[];

  /**
   * Whether the runtime has stopped accepting new requests.
   *
   * This flag does not by itself mean every previously accepted callback
   * finished.
   */
  closed: boolean;
}
