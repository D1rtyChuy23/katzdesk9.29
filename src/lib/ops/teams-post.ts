/**
 * Post one KatzDesk note to a Teams channel webhook.
 * The URL comes from the process environment. It is never returned, logged, or stored.
 */
import { TEAMS_CHANNEL_LABEL, TEAMS_WEBHOOK_ENV, adaptiveCardPayload, type TeamsChannel, type TeamsNote } from "./teams-message.ts";

export type TeamsDelivery = {
  channel: TeamsChannel;
  label: string;
  posted: boolean;
  ready: boolean;
  lines: number;
  error?: string;
};

export type TeamsPoster = (url: string, body: string) => Promise<{ status: number }>;

/** https only, no userinfo. Anything else is treated as not connected. */
export function webhookUrl(channel: TeamsChannel, env: Record<string, string | undefined>): string | null {
  const raw = env[TEAMS_WEBHOOK_ENV[channel]]?.trim() ?? "";
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url.toString();
}

export function channelReady(env: Record<string, string | undefined>): Record<TeamsChannel, boolean> {
  return {
    dispatch: !!webhookUrl("dispatch", env),
    parts: !!webhookUrl("parts", env),
    handoff: !!webhookUrl("handoff", env),
    analytics: !!webhookUrl("analytics", env),
  };
}

export async function deliverTeamsReport(
  note: TeamsNote,
  env: Record<string, string | undefined>,
  post: TeamsPoster,
): Promise<TeamsDelivery> {
  const label = TEAMS_CHANNEL_LABEL[note.channel];
  const url = webhookUrl(note.channel, env);
  if (!url) {
    return {
      channel: note.channel,
      label,
      posted: false,
      ready: false,
      lines: note.lineCount,
      error: `${label} is not connected. The server needs ${TEAMS_WEBHOOK_ENV[note.channel]}.`,
    };
  }
  try {
    const res = await post(url, JSON.stringify(adaptiveCardPayload(note)));
    if (res.status < 200 || res.status >= 300) {
      return {
        channel: note.channel,
        label,
        posted: false,
        ready: true,
        lines: note.lineCount,
        error: `${label} did not accept the note (${res.status}).`,
      };
    }
    return { channel: note.channel, label, posted: true, ready: true, lines: note.lineCount };
  } catch {
    return {
      channel: note.channel,
      label,
      posted: false,
      ready: true,
      lines: note.lineCount,
      error: `${label} could not be reached.`,
    };
  }
}
