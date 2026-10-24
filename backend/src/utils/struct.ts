export class TimedEntry<T> {
  value: T;
  time: number = Date.now();

  constructor(value: T) {
    this.value = value;
  }

  heartbeat(): void {
    this.time = Date.now();
  }
}

