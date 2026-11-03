import { computeGemScore } from '../src/utils/gemScore';

/**
 * Dummy data for demos: 10 Gems around Vancouver, 3 users, and 10 comments
 * (9 on the newest Gem, to show the comment list scrolling, and 1 on the second newest).
 * Every seeded ID starts with `seed-`, so `seedDemoData.ts --reset` can remove exactly this data.
 */

/** Prefix of every seeded Gem's place ID; the Gem names are `places/seed-…`. */
export const SEED_PLACE_PREFIX = 'places/seed-';
/** Prefix of every seeded user's ID. */
export const SEED_USER_PREFIX = 'seed-user-';

/** Match the seeded Gem names (also used by their comments, ratings and favorites) and user IDs. */
export const SEED_GEM_PATTERN = /^places\/seed-/;
export const SEED_USER_PATTERN = /^seed-user-/;

export interface DemoUser {
  googleId: string;
  name: { full: string; given: string; family: string };
  displayName: string;
}

export interface DemoGem {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  type: string;
  description: string;
  /** Google-style rating, 1.0–5.0, and review count; they set the GemScore. */
  rating: number;
  reviewCount: number;
  addedBy: string;
}

export interface DemoComment {
  gem: string;
  commentId: string;
  body: string;
  author: string;
}

export const DEMO_USERS: DemoUser[] = [
  { googleId: 'seed-user-1', name: { full: 'Alex Chen', given: 'Alex', family: 'Chen' }, displayName: 'alexc' },
  { googleId: 'seed-user-2', name: { full: 'Priya Singh', given: 'Priya', family: 'Singh' }, displayName: 'priya.explores' },
  { googleId: 'seed-user-3', name: { full: 'Sam Taylor', given: 'Sam', family: 'Taylor' }, displayName: 'samt' },
];

/** Oldest first: the last one is the newest, so it is first on the dashboard. */
export const DEMO_GEMS: DemoGem[] = [
  {
    name: 'places/seed-trout-lake', displayName: 'Trout Lake Boardwalk', latitude: 49.2560, longitude: -123.0627,
    type: 'park', rating: 4.5, reviewCount: 610, addedBy: 'seed-user-3',
    description: 'A short boardwalk on the quiet side of the lake, good for spotting herons in the morning.',
  },
  {
    name: 'places/seed-beaver-lake', displayName: 'Beaver Lake Loop', latitude: 49.3055, longitude: -123.1440,
    type: 'park', rating: 4.6, reviewCount: 420, addedBy: 'seed-user-1',
    description: 'A lily-covered lake in the middle of Stanley Park, a calm loop away from the seawall crowds.',
  },
  {
    name: 'places/seed-jericho-pier', displayName: 'Jericho Beach Pier', latitude: 49.2724, longitude: -123.1978,
    type: 'beach', rating: 4.6, reviewCount: 380, addedBy: 'seed-user-2',
    description: 'A small pier with a wide view of the North Shore mountains, best at sunset.',
  },
  {
    name: 'places/seed-sun-yat-sen-park', displayName: 'Sun Yat-Sen Park Pond', latitude: 49.2797, longitude: -123.1035,
    type: 'park', rating: 4.6, reviewCount: 290, addedBy: 'seed-user-1',
    description: 'The free public side of the classical garden, with a jade-green pond and koi.',
  },
  {
    name: 'places/seed-salish-trail', displayName: 'Salish Trail, Pacific Spirit Park', latitude: 49.2510, longitude: -123.2205,
    type: 'hiking_area', rating: 4.7, reviewCount: 95, addedBy: 'seed-user-3',
    description: 'A soft, mossy forest trail that feels far from the city, ten minutes from campus.',
  },
  {
    name: 'places/seed-beaty-whale', displayName: 'Blue Whale Skeleton, Beaty Museum', latitude: 49.2633, longitude: -123.2510,
    type: 'museum', rating: 4.7, reviewCount: 240, addedBy: 'seed-user-2',
    description: 'A 26-metre blue whale skeleton hanging in the atrium, visible from the entrance.',
  },
  {
    name: 'places/seed-wreck-beach-steps', displayName: 'Trail 6 Steps to Wreck Beach', latitude: 49.2622, longitude: -123.2612,
    type: 'hiking_area', rating: 4.4, reviewCount: 130, addedBy: 'seed-user-1',
    description: 'Almost 500 steps down through the forest to a long, wild beach below the cliffs.',
  },
  {
    name: 'places/seed-rose-garden-lookout', displayName: 'UBC Rose Garden Lookout', latitude: 49.2693, longitude: -123.2566,
    type: 'garden', rating: 4.7, reviewCount: 210, addedBy: 'seed-user-3',
    description: 'Rows of roses with one of the best views over Howe Sound, right next to the Chan Centre.',
  },
  {
    name: 'places/seed-nitobe-garden', displayName: 'Nitobe Memorial Garden', latitude: 49.2665, longitude: -123.2595,
    type: 'garden', rating: 4.8, reviewCount: 160, addedBy: 'seed-user-2',
    description: 'A traditional Japanese garden with a tea house, stone lanterns and a quiet pond.',
  },
  {
    name: 'places/seed-quarry-garden', displayName: 'Quarry Garden, Queen Elizabeth Park', latitude: 49.2416, longitude: -123.1123,
    type: 'garden', rating: 4.8, reviewCount: 75, addedBy: 'seed-user-1',
    description: 'A sunken garden in an old rock quarry, with a waterfall and paths down to a small bridge.',
  },
];

/** Gem with 9 comments (the newest), and Gem with 1 comment (the second newest). */
const MANY_COMMENTS_GEM = 'places/seed-quarry-garden';
const ONE_COMMENT_GEM = 'places/seed-nitobe-garden';

const MANY_COMMENT_BODIES: [string, string][] = [
  ['seed-user-2', 'The waterfall is so much bigger than I expected!'],
  ['seed-user-3', 'Go early on a weekday, you basically get it to yourself.'],
  ['seed-user-1', 'The little bridge at the bottom is the best photo spot.'],
  ['seed-user-2', 'Came back in the fall, the colours were amazing.'],
  ['seed-user-3', 'Bring a jacket, it gets cool down in the quarry.'],
  ['seed-user-1', 'There is free parking up by the conservatory.'],
  ['seed-user-2', 'Perfect place to read for an hour. Lots of benches.'],
  ['seed-user-3', 'Some of the stairs are steep, take your time.'],
  ['seed-user-1', 'Walked up to the lookout afterwards, great view of downtown.'],
];

/** Oldest first. */
export const DEMO_COMMENTS: DemoComment[] = [
  ...MANY_COMMENT_BODIES.map(([author, body], i) => ({
    gem: MANY_COMMENTS_GEM,
    commentId: `seed-comment-${String(i + 1).padStart(2, '0')}`,
    body,
    author,
  })),
  { gem: ONE_COMMENT_GEM, commentId: 'seed-comment-10', author: 'seed-user-3', body: 'So peaceful. Worth the small entry fee.' },
];

/**
 * @param gem a demo Gem.
 * @param createdAt when it was "added".
 * @returns the document to store, scored the same way `GemService` scores a new Gem.
 */
export function gemDoc(gem: DemoGem, createdAt: Date): Record<string, unknown> {
  const { score, nicheness } = computeGemScore({ rating: gem.rating, reviewCount: gem.reviewCount });

  return {
    name: gem.name,
    place: {
      name: gem.name,
      displayName: gem.displayName,
      location: { type: 'Point', coordinates: [gem.longitude, gem.latitude] },
    },
    type: gem.type,
    description: gem.description,
    quality: gem.rating,
    reviewCount: gem.reviewCount,
    nicheness,
    score,
    scoreTime: createdAt.getTime(),
    addedBy: gem.addedBy,
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * @param comment a demo comment.
 * @param createdAt when it was "written".
 * @returns the document to store, with the author's display name as the app stores it.
 */
export function commentDoc(comment: DemoComment, createdAt: Date): Record<string, unknown> {
  const author = DEMO_USERS.find(u => u.googleId === comment.author);

  return {
    gem: comment.gem,
    commentId: comment.commentId,
    body: comment.body,
    author: comment.author,
    authorName: author?.displayName ?? author?.name.full,
    createdAt,
    updatedAt: createdAt,
  };
}
