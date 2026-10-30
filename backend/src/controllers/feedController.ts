import type { Server } from "node:http";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import FeedService, { FEED_RADIUS_DEFAULT_M, FEED_RADIUS_MAX_M, type FeedClient } from "../services/feedService";
import { toIntInRange, toLatLng } from "../utils/geo";

/** WebSocket path of the live feed: `ws://<server>/feed`. */
export const FEED_PATH = '/feed';

/** Largest message a client may send, in bytes; a subscribe message is well under 200. */
const MAX_MESSAGE_BYTES = 1024;

/** Shortest time between two subscribe messages from one client, in ms. */
export const MIN_SUBSCRIBE_INTERVAL_MS = 1_000;

/** How often clients are pinged; a client that hasn't answered the previous ping is dropped. */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/** The app's one live feed, shared with the Gem routes that publish to it. */
export const feedService = new FeedService();

/** What a client may send. */
interface SubscribeMessage {
  type: 'subscribe';
  latitude: unknown;
  longitude: unknown;
  radius?: unknown;
}

/** A connected client as the message handler sees it. */
export interface FeedConnection extends FeedClient {
  /** When the client last subscribed, in ms since epoch; 0 if never. */
  lastSubscribe: number;
  /** @param message sent as `{ type: 'error', message }`. */
  sendError(message: string): void;
}

/** One connected client, wrapping its socket. */
class SocketClient implements FeedConnection {
  /** Set by each pong; cleared before each ping. */
  alive = true;
  /** When the client last subscribed, in ms since epoch; 0 if never. */
  lastSubscribe = 0;

  constructor(private readonly socket: WebSocket) {}

  /** @param data a JSON message. Dropped if the socket is no longer open. */
  send(data: string): void {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(data);
    }
  }

  /** @param message sent as `{ type: 'error', message }`; the connection stays open. */
  sendError(message: string): void {
    this.send(JSON.stringify({ type: 'error', message }));
  }
}

/**
 * Parses a raw WebSocket message.
 *
 * @param raw the message as received.
 * @param isBinary whether it was sent as binary; only text messages are accepted.
 * @returns the JSON value, or `undefined` if it is binary or not valid JSON.
 */
export function parseMessage(raw: RawData, isBinary: boolean): unknown {
  if (isBinary) {
    return undefined;
  }

  try {
    return JSON.parse(raw.toString()) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * @param value a parsed message.
 * @returns `true` if it is an object with `type: 'subscribe'`.
 */
function isSubscribeMessage(value: unknown): value is SubscribeMessage {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'subscribe';
}

/**
 * Handles one message from a client.
 *
 * Accepts `{ type: 'subscribe', latitude, longitude, radius? }` and answers
 * `{ type: 'subscribed', latitude, longitude, radius }`; anything else gets
 * `{ type: 'error', message }` and the connection stays open.
 *
 * @param service the feed to subscribe the client to.
 * @param client the client that sent the message.
 * @param message the parsed message, or `undefined` if it wasn't JSON.
 * @param now the current time, in ms since epoch.
 */
export function handleFeedMessage(service: FeedService, client: FeedConnection, message: unknown, now: number): void {
  if (message === undefined) {
    client.sendError('Invalid JSON.');
    return;
  }
  if (!isSubscribeMessage(message)) {
    client.sendError('Unknown message type.');
    return;
  }

  const center = toLatLng(message.latitude, message.longitude);
  if (!center) {
    client.sendError('Invalid location.');
    return;
  }

  const radius = toIntInRange(message.radius, FEED_RADIUS_DEFAULT_M, 1, FEED_RADIUS_MAX_M);
  if (radius === undefined) {
    client.sendError('Invalid radius.');
    return;
  }

  if (now - client.lastSubscribe < MIN_SUBSCRIBE_INTERVAL_MS) {
    client.sendError('Too many subscriptions.');
    return;
  }

  client.lastSubscribe = now;
  service.subscribe(client, { center, radius });
  client.send(JSON.stringify({ type: 'subscribed', ...center, radius }));
}

/**
 * Serves the live feed as a WebSocket at `/feed` on the app's HTTP server.
 *
 * A client connects, sends `{ type: 'subscribe', latitude, longitude, radius? }` (its location;
 * radius in metres, default 5000, max 50000), and from then on gets `{ type: 'gem.added', gem }`
 * whenever a Gem is added within that radius. Subscribing again moves the subscription.
 * Clients are pinged every 30 s; one that misses a ping is dropped at the next one, so a dead
 * client is gone 30–60 s after it stops answering.
 *
 * TODO Require a session (like the REST routes, once `reqSession` is merged): anyone can subscribe for now.
 *
 * @param server the HTTP server the Express app listens on.
 * @param service the feed to serve; defaults to the app's one.
 * @param heartbeatIntervalMs how often to ping clients; only tests change it.
 * @returns the WebSocket server, so it can be closed on shutdown.
 */
export function attachFeed(
  server: Server,
  service: FeedService = feedService,
  heartbeatIntervalMs: number = HEARTBEAT_INTERVAL_MS,
): WebSocketServer {
  const wss = new WebSocketServer({ server, path: FEED_PATH, maxPayload: MAX_MESSAGE_BYTES });
  const clients = new Map<WebSocket, SocketClient>();

  wss.on('connection', (socket) => {
    const client = new SocketClient(socket);
    clients.set(socket, client);

    socket.on('pong', () => { client.alive = true; });
    socket.on('message', (raw, isBinary) => {
      handleFeedMessage(service, client, parseMessage(raw, isBinary), Date.now());
    });
    socket.on('close', () => {
      clients.delete(socket);
      service.unsubscribe(client);
    });
    // Errors (e.g. a message over maxPayload) close the socket; 'close' then cleans up.
    socket.on('error', () => undefined);
  });

  const heartbeat = setInterval(() => {
    for (const [socket, client] of clients) {
      if (!client.alive) {
        socket.terminate();
        continue;
      }
      client.alive = false;
      socket.ping();
    }
  }, heartbeatIntervalMs);
  // Don't keep the process (or a test run) alive just for the heartbeat.
  heartbeat.unref();

  wss.on('close', () => clearInterval(heartbeat));

  return wss;
}

/**
 * Shuts the feed down: disconnects every client, then stops accepting new ones.
 * `wss.close()` alone leaves open connections running, and the HTTP server's `close()` would then
 * wait on them forever, so call this before closing the HTTP server.
 *
 * @param wss the feed's WebSocket server, from `attachFeed`.
 * @returns resolves once the WebSocket server is closed.
 */
export function closeFeed(wss: WebSocketServer): Promise<void> {
  for (const client of wss.clients) {
    client.terminate();
  }

  return new Promise(resolve => wss.close(() => resolve()));
}

