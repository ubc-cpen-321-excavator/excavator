export function safeToString(input: unknown): string {
  try {
    return String(input);
  } catch {
    return 'input.toString() failed.';
  }
}

export function alphOnly(input: unknown): string {
  return safeToString(input).replace(/[^a-zA-Z]+/g, '')
}

export function numOnly(input: unknown): string {
  return safeToString(input).replace(/[^0-9]+/g, '')
}

export function alphnumOnly(input: unknown): string {
  return safeToString(input).replace(/[^a-zA-Z0-9]+/g, '')
}

export function alphnumDashOnly(input: unknown): string {
  return safeToString(input).replace(/[^a-zA-Z0-9_-]+/g, '')
}
