/**
 * FIFO admission queue for the lifetime of parser extraction callbacks.
 *
 * Acquire reserves ownership until the caller releases it in cleanup. Closing
 * rejects new requests while allowing already queued requests to drain, so the
 * parser runtime can wait for all accepted native-resource owners to finish.
 */
export class EvidParserSlots {
  /**
   * Number of reserved slots, including slots transferred to queued requests.
   *
   * A transfer keeps this count unchanged until the receiving request releases
   * it.
   */
  public active = 0;

  /**
   * Whether admission has closed to new requests.
   *
   * Accepted requests may still be active or queued while close waits for
   * drainage.
   */
  public closed = false;

  /**
   * Resolvers waiting for ownership in arrival order.
   *
   * Releasing a slot wakes the oldest request before reducing the active count.
   */
  private readonly queue: (() => void)[] = [];

  /**
   * Close callers waiting for the final reserved slot to be released.
   *
   * Retaining all resolvers makes repeated concurrent close calls await one
   * drain.
   */
  private readonly drains: (() => void)[] = [];

  /**
   * Creates an empty queue with the parser runtime's validated concurrency
   * limit.
   *
   * Validation belongs to the public parser options boundary; this queue only
   * manages ownership and assumes a positive integer limit.
   */
  public constructor(
    /**
     * Maximum simultaneously reserved slots.
     *
     * Requests beyond this bound wait until an existing owner releases its
     * slot.
     */
    private readonly limit: number,
  ) {}

  /**
   * Counts accepted requests that do not yet own a slot.
   *
   * Runtime state inspection uses this separately from the active reservation
   * count.
   */
  public get waiting(): number {
    return this.queue.length;
  }

  /**
   * Reserves an available slot or waits for FIFO ownership transfer.
   *
   * Requests arriving after close reject immediately. A request accepted before
   * close still resumes and must eventually call release exactly once.
   */
  public async acquire(): Promise<void> {
    if (this.closed) throw new Error("The parser runtime is closed.");
    if (this.active < this.limit) {
      ++this.active;
      return;
    }
    const pending: Promise<void> = new Promise((resolve) => {
      this.queue.push(resolve);
    });
    await pending;
  }

  /**
   * Relinquishes one acquired slot and advances accepted work.
   *
   * The caller must have acquired ownership. Once no queued successor or active
   * owner remains, every pending close operation is released.
   */
  public release(): void {
    const next = this.queue.shift();
    // Transfer ownership without lowering active: close must not observe a
    // temporary zero while an already accepted request is about to resume.
    if (next !== undefined) next();
    else {
      --this.active;
      if (this.active === 0) for (const drain of this.drains.splice(0)) drain();
    }
  }

  /**
   * Stops new admission and waits for every accepted request to release
   * ownership.
   *
   * Call this outside an owned slot; awaiting close while holding a slot would
   * wait for the caller's own release.
   */
  public async close(): Promise<void> {
    this.closed = true;
    if (this.active === 0) return;
    const pending: Promise<void> = new Promise((resolve) => {
      this.drains.push(resolve);
    });
    await pending;
  }
}
