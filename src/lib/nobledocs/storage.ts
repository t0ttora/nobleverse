'use client';

// NobleDocs removed: provide no-op stubs to keep imports harmless until routes are cleaned up.
export function listDocuments(): never[] {
  return [];
}
export function getDocument(_id: string): undefined {
  return undefined;
}
export function saveDocument(_doc: never): void {
  /* noop */
}
export function createDocument(_partial?: Partial<never>): never {
  throw new Error('NobleDocs removed');
}
export function deleteDocument(_id: string): void {
  /* noop */
}
