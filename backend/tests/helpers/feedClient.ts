import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import WebSocket, { type ClientOptions } from 'ws';

/**
 * A WebSocket client for tests: queues incoming JSON messages so a test can await them in order.
 */
export class TestFeedClient {
  private queue: unknown[] = [];
  private waiting: ((message: unknown) => void)[] = [];
  /** Resolves with the close code once the connection closes. */
  readonly closed: Promise<number>;

  private constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const message: unknown = JSON.parse(data.toString());
      const waiter = this.waiting.shift();
      if (waiter) {
        waiter(message);
      } else {
        this.queue.push(message);
      }
    });
    this.closed = new Promise(resolve => socket.on('close', (code) => resolve(code)));
  }

  /**
   * @param url e.g. `ws://127.0.0.1:1234/feed`.
   * @param options passed to `ws`, e.g. `{ autoPong: false }`.
   * @returns the connected client.
   */
  static connect(url: string, options?: ClientOptions): Promise<TestFeedClient> {
    const socket = new WebSocket(url, options);
    return new Promise((resolve, reject) => {
      socket.once('open', () => resolve(new TestFeedClient(socket)));
      socket.once('error', reject);
    });
  }

  /** @param message sent as JSON text. */
  send(message: unknown): void {
    this.socket.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  /**
   * @param timeoutMs how long to wait.
   * @returns the next message received.
   */
  next(timeoutMs = 2000): Promise<unknown> {
    const queued = this.queue.shift();
    if (queued !== undefined) {
      return Promise.resolve(queued);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting = this.waiting.filter(w => w !== waiter);
        reject(new Error('No message within timeout.'));
      }, timeoutMs);
      const waiter = (message: unknown): void => {
        clearTimeout(timer);
        resolve(message);
      };
      this.waiting.push(waiter);
    });
  }

  /**
   * @param ms how long to wait.
   * @returns every message received in that time (none expected in most uses).
   */
  async drain(ms = 200): Promise<unknown[]> {
    await new Promise(resolve => setTimeout(resolve, ms));
    const messages = this.queue;
    this.queue = [];
    return messages;
  }

  /** Closes the connection and waits for it to close. */
  async close(): Promise<void> {
    if (this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close();
    }
    await this.closed;
  }
}

/**
 * @param server a listening HTTP server.
 * @returns the feed's WebSocket URL on it.
 */
export function feedUrl(server: Server): string {
  const { port } = server.address() as AddressInfo;
  return `ws://127.0.0.1:${port}/feed`;
}

/**
 * Waits until `check` returns true, polling every 10 ms.
 *
 * @throws if it is still false after `timeoutMs`.
 */
export async function waitFor(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Condition not met within timeout.');
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
