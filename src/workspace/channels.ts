import type { Channel } from '../types.js';

/** Release channels in promotion order: dev → beta → stable. */
export const CHANNELS: Channel[] = ['dev', 'beta', 'stable'];

export function isValidChannel(value: string): value is Channel {
  return (CHANNELS as string[]).includes(value);
}

/** Ordinal position of a channel (dev=0, beta=1, stable=2). */
export function channelRank(channel: Channel): number {
  return CHANNELS.indexOf(channel);
}

/** The next channel up the promotion ladder, or null if already at stable. */
export function nextChannel(channel: Channel): Channel | null {
  const i = CHANNELS.indexOf(channel);
  return i >= 0 && i < CHANNELS.length - 1 ? CHANNELS[i + 1] : null;
}
