export function isEmptyPreviewBody(body: string | null | undefined): boolean {
  return body === null || body === undefined || body.trim().length === 0;
}
