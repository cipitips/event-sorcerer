export function createMap<T = any>(): Record<string, T> {
  return Object.create(null);
}

export function die(message?: string): never {
  throw new Error(message);
}

export function assert(condition: unknown, message?: string): void {
  if (!condition) {
    die(message);
  }
}
