export function safeToString(input: any): string {
  try {
    return input.toString();
  } catch (err) {
    return 'input.toString() failed.';
  }
}

export function alphOnly(input: any): string {
  return safeToString(input).replace(/[^a-zA-Z]+/g, '')
}

export function numOnly(input: any): string {
  return safeToString(input).replace(/[^0-9]+/g, '')
}

export function alphnumOnly(input: any): string {
  return safeToString(input).replace(/[^a-zA-Z0-9]+/g, '')
}

export function alphnumDashOnly(input: any): string {
  return safeToString(input).replace(/[^a-zA-Z0-9\-\_]+/g, '')
}

