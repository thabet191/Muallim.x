/**
 * All API error responses use this shape so client code can reliably read
 * `data.error` after `response.json()` — a plain-text Response body used to
 * be silently swallowed by `.json()`, masking the real reason from the user
 * behind a generic fallback message.
 */
export function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
