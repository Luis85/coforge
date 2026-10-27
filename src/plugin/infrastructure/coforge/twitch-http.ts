import type { Timers } from '../../features/coforge/application/ports';
import { IntegrationFailure } from '../../features/coforge/domain/integration-failure';
export interface HttpResponse { status: number; json: unknown; headers?: Record<string, string> }
export type HttpRequest = (input: { url: string; method?: string; headers: Record<string, string>; body?: string }) => Promise<HttpResponse>;
export class TwitchError extends IntegrationFailure {}
export const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
export function requestWithDeadline(request: HttpRequest, timers: Timers): HttpRequest {
  return async input => {
    let timer: number | undefined;
    try {
      return await Promise.race([request(input), new Promise<never>((_, reject) => {
        timer = timers.setTimeout(() => reject(new TwitchError('uncertain', 'Twitch did not confirm the operation. Check the channel before trying again.')), 12_000);
      })]);
    } catch (error) {
      if (error instanceof TwitchError) throw error;
      throw new TwitchError('uncertain', 'The connection ended before Twitch confirmed the operation.');
    } finally { if (timer !== undefined) timers.clearTimeout(timer); }
  };
}
export function assertResponse(response: HttpResponse): void {
  if (response.status >= 200 && response.status < 300) return;
  if (response.status === 401) throw new TwitchError('authorization', 'Reconnect the Twitch account; its authorization is no longer valid.');
  if (response.status === 403) throw new TwitchError('permission', 'Twitch denied this action. Check the connected account and its channel permissions.');
  if (response.status === 429) throw new TwitchError('rate', 'Twitch is rate limiting this account. Wait before trying again.');
  if (response.status === 400) throw new TwitchError('validation', 'Twitch rejected this request. Check the selected target and settings.');
  if (response.status === 404 || response.status === 409) throw new TwitchError('delivery', 'The Twitch target is unavailable or has changed. Refresh its status before trying again.');
  throw new TwitchError('service', 'Twitch could not complete this operation. Try again when the service is available.');
}
