/**
 * Server logging that can't be used to forge log entries (log injection, CWE-117).
 * Every logged value goes through `sanitizeForLog`, which replaces control characters,
 * including CR and LF, so a value from a request can't start a fake log line.
 */

/** Logged values longer than this are cut, so one request can't flood the log. */
const MAX_LOGGED_LENGTH = 500;

/**
 * Turns a value into a single log-safe line.
 *
 * @param value anything: an `Error` is shown as `name: message`, other values as text.
 * @returns the text, with control characters replaced by spaces and cut to 500 characters.
 */
export function sanitizeForLog(value: unknown): string {
  const text = value instanceof Error ? `${value.name}: ${value.message}` : String(value);

  return Array.from(text.slice(0, MAX_LOGGED_LENGTH), ch => {
    const code = ch.charCodeAt(0);
    return code < 0x20 || code === 0x7f ? ' ' : ch;
  }).join('');
}

/**
 * Logs an informational message to stdout.
 *
 * @param message what happened, e.g. `'Connected to MongoDB.'`.
 */
export function logInfo(message: string): void {
  console.info(sanitizeForLog(message));
}

/**
 * Logs a failure to stderr, as `<message>: <error>`.
 *
 * @param message what failed, e.g. `'Get Gem failed'`.
 * @param err the error, if there is one.
 */
export function logError(message: string, err?: unknown): void {
  const line = err === undefined ? message : `${message}: ${sanitizeForLog(err)}`;
  console.error(sanitizeForLog(line));
}
