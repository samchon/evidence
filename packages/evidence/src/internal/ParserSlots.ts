/** Reserves FIFO session slots and drains accepted work before closing. */
export class ParserSlots {
  public active = 0;
  public closed = false;
  private readonly queue: (() => void)[] = [];
  private readonly drains: (() => void)[] = [];

  public constructor(private readonly limit: number) {}

  public get waiting(): number {
    return this.queue.length;
  }

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

  public release(): void {
    const next = this.queue.shift();
    if (next !== undefined) next();
    else {
      --this.active;
      if (this.active === 0) for (const drain of this.drains.splice(0)) drain();
    }
  }

  public async close(): Promise<void> {
    this.closed = true;
    if (this.active === 0) return;
    const pending: Promise<void> = new Promise((resolve) => {
      this.drains.push(resolve);
    });
    await pending;
  }
}
