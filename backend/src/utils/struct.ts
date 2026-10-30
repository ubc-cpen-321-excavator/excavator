export class TimedEntry<T> {
  value: T;
  time: number;

  constructor(value: T) {
    this.time = Date.now();
    this.value = value;
  }

  heartbeat(): void {
    this.time = Date.now();
  }
}

