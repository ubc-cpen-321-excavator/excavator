import {
  DEMO_COMMENTS,
  DEMO_GEMS,
  DEMO_USERS,
  SEED_GEM_PATTERN,
  SEED_PLACE_PREFIX,
  SEED_USER_PATTERN,
  SEED_USER_PREFIX,
  commentDoc,
  gemDoc,
} from '../../scripts/demoData';
import { CommentModel } from '../../src/models/commentModel';
import { GemModel } from '../../src/models/gemModel';
import { UserModel } from '../../src/models/userModel';
import { isValidGemName } from '../../src/services/gemService';

/** Number of Gems the dashboard shows. */
const DASHBOARD_GEMS = 6;

// The demo data in scripts/demoData.ts, checked without a database
describe('Demo data', () => {
  // Input: the demo Gems
  // Expected behavior: 10 Gems, more than the dashboard shows, with valid and distinct seed names
  test('10 Gems with valid seed names', () => {
    expect(DEMO_GEMS).toHaveLength(10);
    expect(DEMO_GEMS.length).toBeGreaterThan(DASHBOARD_GEMS);
    expect(new Set(DEMO_GEMS.map(g => g.name)).size).toBe(DEMO_GEMS.length);
    for (const gem of DEMO_GEMS) {
      expect(isValidGemName(gem.name)).toBe(true);
      expect(gem.name.startsWith(SEED_PLACE_PREFIX)).toBe(true);
      expect(SEED_GEM_PATTERN.test(gem.name)).toBe(true);
    }
    // --reset deletes by pattern, so it must not match a real Gem
    expect(SEED_GEM_PATTERN.test('places/ChIJN1t_tDeuEmsRUsoyG83frY4')).toBe(false);
  });

  // Input: the demo comments
  // Expected behavior: 10 comments, 9 on one Gem and 1 on another, both shown on the dashboard
  test('9 comments on the newest Gem, 1 on the second newest', () => {
    const perGem = new Map<string, number>();
    for (const c of DEMO_COMMENTS) {
      perGem.set(c.gem, (perGem.get(c.gem) ?? 0) + 1);
    }
    const newest = DEMO_GEMS.map(g => g.name).reverse();

    expect(DEMO_COMMENTS).toHaveLength(10);
    expect(new Set(DEMO_COMMENTS.map(c => `${c.gem} ${c.commentId}`)).size).toBe(DEMO_COMMENTS.length);
    expect(perGem).toEqual(new Map([[newest[0], 9], [newest[1], 1]]));
  });

  // Input: every Gem's adder and comment's author
  // Expected behavior: each is one of the seeded users
  test('Every user referenced is seeded', () => {
    const users = new Set(DEMO_USERS.map(u => u.googleId));

    expect([...users].every(id => id.startsWith(SEED_USER_PREFIX) && SEED_USER_PATTERN.test(id))).toBe(true);
    expect(SEED_USER_PATTERN.test('115739283746598273645')).toBe(false);
    for (const id of [...DEMO_GEMS.map(g => g.addedBy), ...DEMO_COMMENTS.map(c => c.author)]) {
      expect(users.has(id)).toBe(true);
    }
  });

  // Input: the documents the seed script stores
  // Expected behavior: each passes the Mongoose schema it is stored with
  test('Documents match the schemas', () => {
    const at = new Date('2026-11-02T12:00:00Z');

    for (const gem of DEMO_GEMS) {
      const doc = gemDoc(gem, at);
      expect(new GemModel(doc).validateSync()).toBeUndefined();
      expect(doc.score).toEqual(expect.any(Number));
      expect(doc.place).toMatchObject({ location: { coordinates: [gem.longitude, gem.latitude] } });
    }
    for (const comment of DEMO_COMMENTS) {
      const doc = commentDoc(comment, at);
      expect(new CommentModel(doc).validateSync()).toBeUndefined();
      expect(doc.authorName).toEqual(expect.any(String));
    }
    for (const user of DEMO_USERS) {
      expect(new UserModel(user).validateSync()).toBeUndefined();
    }
  });
});
