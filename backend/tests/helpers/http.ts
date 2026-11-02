import type { Express } from 'express';
import request from 'supertest';

/** HTTP methods the 405 tests send. */
export type TestMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * Starts a supertest request with the method given as data, for `test.each` tables.
 * A `switch` rather than `request(app)[method]`, so no object is indexed with a variable.
 *
 * @param app the app under test.
 * @param method the HTTP method.
 * @param path e.g. `/gem`.
 * @returns the request, to `.set(...)` headers on or await.
 */
export function requestWith(app: Express, method: TestMethod, path: string): request.Test {
  const agent = request(app);
  switch (method) {
    case 'get':
      return agent.get(path);
    case 'post':
      return agent.post(path);
    case 'put':
      return agent.put(path);
    case 'patch':
      return agent.patch(path);
    case 'delete':
      return agent.delete(path);
  }
}
