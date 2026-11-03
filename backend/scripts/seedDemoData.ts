import { connectDB, disconnectDB } from '../src/config/db';
import { env } from '../src/config/env';
import { logError, logInfo } from '../src/utils/log';
import { reset, seed } from './seed';

/**
 * Fills the database with the demo data in `demoData.ts`, or removes it.
 *
 *   npm run seed              add (or refresh) the demo data
 *   npm run seed -- --reset   remove the demo data only
 *
 * Uses MONGODB_URI, like the server. Safe to run again: seeded documents are matched by their
 * `seed-` IDs and overwritten, and nothing else in the database is touched.
 */

/**
 * Seeds or resets, and logs what changed.
 *
 * @param resetOnly `true` to remove the demo data instead of adding it.
 */
async function run(resetOnly: boolean): Promise<void> {
  if (resetOnly) {
    const removed = await reset();
    logInfo(`Removed ${removed.gems} Gems, ${removed.comments} comments, ${removed.ratings} ratings, `
      + `${removed.favorites} favorites and ${removed.users} users.`);
  } else {
    const written = await seed();
    logInfo(`Seeded ${written.users} users, ${written.gems} Gems and ${written.comments} comments.`);
  }
}

/**
 * Connects, seeds or resets, and disconnects.
 *
 * @param args command-line arguments; `--reset` removes the demo data instead.
 */
async function main(args: string[]): Promise<void> {
  logInfo(`Using ${env.mongodb_uri.replace(/\/\/[^@/]*@/, '//<credentials>@')}`);
  await connectDB();
  try {
    await run(args.includes('--reset'));
  } catch (err) {
    logError('Seeding failed', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main(process.argv.slice(2)).catch((err: unknown) => {
  logError('Could not connect to MongoDB', err);
  process.exitCode = 1;
});
