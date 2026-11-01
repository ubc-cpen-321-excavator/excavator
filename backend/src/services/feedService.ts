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

/**
 * Pushed to a client about a Gem within its subscription:
 * `gem.added` when the Gem is added, `gem.updated` when it changes (e.g. its GemScore after a rating).
 */
export interface GemMessage {
  type: 'gem.added' | 'gem.updated';
  gem: Gem;
}

/**
 * The live feed: keeps who is listening where, and pushes new and changed Gems to everyone in range.
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
    return this.publish({ type: 'gem.added', gem });
  }

  /**
   * Pushes a changed Gem (e.g. a new GemScore after a rating) to every client whose subscription contains it.
   * A client that fails to receive it is unsubscribed; the others still get it.
   *
   * @param gem the Gem as it is now.
   * @returns how many clients it was sent to.
   */
  publishGemUpdated(gem: Gem): number {
    return this.publish({ type: 'gem.updated', gem });
  }

  /**
   * Sends a message about a Gem to every client in range of it.
   *
   * @param message the message; its Gem's location decides who gets it.
   * @returns how many clients it was sent to.
   */
  private publish(message: GemMessage): number {
    const { gem } = message;
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
