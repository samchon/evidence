/** Coordinates asynchronous scenarios without timing-dependent sleeps. */
export class TestSignal {
  private resolve: (() => void) | undefined;
  public readonly wait: Promise<void>;

  public constructor() {
    this.wait = new Promise<void>((resolve) => {
      this.resolve = resolve;
    });
  }

  public open(): void {
    this.resolve?.();
  }
}
