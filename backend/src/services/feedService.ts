import type { Gem } from "./gemService";
import { distanceMeters, type LatLng } from "../utils/geo";

/** Default and largest radius a client can subscribe to, in metres. */
export const FEED_RADIUS_DEFAULT_M = 5_000;
export const FEED_RADIUS_MAX_M = 50_000;

/** Anything the feed can push a message to, e.g. a WebSocket connection. */
export interface FeedClient {
  /** @param data a JSON message. */
  send(data: string): void;
}

/** Where a client wants to hear about new Gems. */
export interface FeedSubscription {
  center: LatLng;
  /** In metres. */
  radius: number;
}

/** Pushed to a client when a Gem is added within its subscription. */
export interface GemAddedMessage {
  type: 'gem.added';
  gem: Gem;
}

/**
 * The live feed: keeps who is listening where, and pushes new Gems to everyone in range.
 * Knows nothing about WebSockets or the database, so it can be tested on its own.
 */
class FeedService {
  private subscriptions: Map<FeedClient, FeedSubscription> = new Map<FeedClient, FeedSubscription>();

  /**
   * Starts or moves a client's subscription. A client has at most one; subscribing again replaces it.
   *
   * @param client where to push messages.
   * @param subscription the area to listen to; not validated here (the socket layer does that).
   */
  subscribe(client: FeedClient, subscription: FeedSubscription): void {
    this.subscriptions.set(client, subscription);
  }

  /**
   * Stops pushing to a client, e.g. when it disconnects.
   *
   * @param client the client.
   * @returns `true` if the client was subscribed.
   */
  unsubscribe(client: FeedClient): boolean {
    return this.subscriptions.delete(client);
  }

  /**
   * @returns how many clients are subscribed.
   */
  size(): number {
    return this.subscriptions.size;
  }

  /**
   * Pushes a new Gem to every client whose subscription contains it.
   * A client that fails to receive it is unsubscribed; the others still get it.
   *
   * @param gem the Gem that was just added.
   * @returns how many clients it was sent to.
   */
  publishGemAdded(gem: Gem): number {
    const message: GemAddedMessage = { type: 'gem.added', gem };
    const data = JSON.stringify(message);
    const location = { latitude: gem.place.latitude, longitude: gem.place.longitude };

    let sent = 0;
    for (const [client, { center, radius }] of [...this.subscriptions]) {
      if (distanceMeters(center, location) > radius) {
        continue;
      }

      try {
        client.send(data);
        sent++;
      } catch {
        // A broken connection shouldn't stop the others from getting the Gem.
        this.subscriptions.delete(client);
      }
    }

    return sent;
  }
}

export default FeedService
