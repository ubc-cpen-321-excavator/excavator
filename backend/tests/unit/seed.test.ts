import request from 'supertest';

import { DEMO_COMMENTS, DEMO_GEMS } from '../../scripts/demoData';
import { reset, seed } from '../../scripts/seed';
import { createApp } from '../../src/app';
import { CommentModel } from '../../src/models/commentModel';
import { GemModel } from '../../src/models/gemModel';
import { UserModel } from '../../src/models/userModel';
import { TEST_USER_ID } from '../helpers/auth';
import { DB_START_TIMEOUT_MS, UBC, clearDb, seedGem, seedUser, startDb, stopDb } from '../helpers/db';

beforeAll(startDb, DB_START_TIMEOUT_MS);
afterAll(stopDb);
beforeEach(clearDb);

/** @returns the place ID in a Gem name, for `/gem/:pk/...` routes. */
function pk(gemName: string): string {
  return gemName.replace('places/', '');
}

// The demo-data seed script (scripts/seed.ts), on a real in-memory MongoDB
describe('Demo data seeding', () => {
  // Input: seed() on an empty database, then the dashboard's and comment list's requests
  // Expected behavior: 10 Gems, the newest first on the dashboard; 9 comments on the newest, 1 on the next, 0 on the rest
  test('Seed, then read through the API', async () => {
    expect(await seed()).toEqual({ users: 3, gems: 10, comments: 10 });

    const app = createApp();
    const newest = await request(app).get('/gem/newest').query({ limit: '6' });
    const names = (newest.body as { name: string }[]).map(g => g.name);
    expect(newest.status).toBe(200);
    expect(names).toEqual(DEMO_GEMS.map(g => g.name).reverse().slice(0, 6));

    const counts: number[] = [];
    for (const name of names) {
      const comments = await request(app).get(`/gem/${pk(name)}/comments`);
      expect(comments.status).toBe(200);
      counts.push((comments.body as unknown[]).length);
    }
    expect(counts).toEqual([9, 1, 0, 0, 0, 0]);

    const many = await request(app).get(`/gem/${pk(names[0] ?? '')}/comments`);
    expect((many.body as { body: string }[]).map(c => c.body))
      .toEqual(DEMO_COMMENTS.filter(c => c.gem === names[0]).map(c => c.body));
    expect(many.body).toContainEqual(expect.objectContaining({ author: 'seed-user-2', authorName: 'priya.explores' }));
  });

  // Input: seed(), a change to a demo Gem (as a rating would make), then seed() again, as on every deploy
  // Expected behavior: the second run adds nothing and keeps the stored Gems' dates and the change
  test('Running again adds nothing and keeps changes', async () => {
    // Literal names in the queries; the first check keeps them in step with demoData.ts.
    expect(DEMO_GEMS[DEMO_GEMS.length - 1]?.name).toBe('places/seed-quarry-garden');
    await seed();
    const before = await GemModel.findOne({ name: 'places/seed-quarry-garden' }).lean();
    await GemModel.updateOne({ name: 'places/seed-quarry-garden' }, { $set: { score: 1, ratingCount: 1, ratingAverage: 1 } });

    expect(await seed()).toEqual({ users: 0, gems: 0, comments: 0 });
    expect(await GemModel.countDocuments()).toBe(10);
    expect(await CommentModel.countDocuments()).toBe(10);
    expect(await UserModel.countDocuments()).toBe(3);
    expect(await GemModel.findOne({ name: 'places/seed-quarry-garden' }).lean())
      .toMatchObject({ createdAt: before?.createdAt, score: 1, ratingCount: 1, ratingAverage: 1 });
  });

  // Input: seed() after one demo Gem was deleted
  // Expected behavior: only the missing Gem is added back
  test('Adds back only what is missing', async () => {
    expect(DEMO_GEMS[0]?.name).toBe('places/seed-trout-lake');
    await seed();
    await GemModel.deleteOne({ name: 'places/seed-trout-lake' });

    expect(await seed()).toEqual({ users: 0, gems: 1, comments: 0 });
    expect(await GemModel.countDocuments()).toBe(10);
  });

  // Input: a real Gem and user, then seed() and reset()
  // Expected behavior: reset removes only the demo data; the real Gem and user stay
  test('Reset removes only the demo data', async () => {
    await seedGem('cafe', UBC);
    await seedUser();
    await seed();

    expect(await reset()).toEqual({ gems: 10, comments: 10, ratings: 0, favorites: 0, users: 3 });
    expect(await GemModel.find().distinct('name')).toEqual(['places/cafe']);
    expect(await UserModel.find().distinct('googleId')).toEqual([TEST_USER_ID]);
    expect(await CommentModel.countDocuments()).toBe(0);
  });
});
