/** Workflow endpoints are public; authentication belongs to native secret settings. */

/** @param value - Public workflow notification endpoint. @returns Endpoint without URL credentials. */
export function publicWebhookUrl(value: string): string {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username !== '' || url.password !== '' || url.hash !== '' || url.search !== '') throw new Error('workflow notification URLs must omit credentials, queries and fragments; configure native secret settings instead')
  return value
}
