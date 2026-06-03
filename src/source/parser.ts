import * as path from 'node:path';
import type { ParsedSource } from '../types.js';
import { sanitizeSubpath } from '../util/sanitize.js';

const GITHUB_SHORTHAND = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\/(.+))?$/;
const GITHUB_URL = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.+))?)?$/;
const GIT_SSH = /^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/;

export function parseSource(input: string): ParsedSource {
  const raw = input.trim();

  if (raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('/') || raw.match(/^[A-Z]:\\/)) {
    return { type: 'local', localPath: path.resolve(raw), raw };
  }

  const ghUrl = raw.match(GITHUB_URL);
  if (ghUrl) {
    const subpath = ghUrl[4] ? sanitizeSubpath(ghUrl[4]) : undefined;
    if (ghUrl[4] && subpath === null) {
      throw new Error(`Unsafe subpath in URL: ${raw}`);
    }
    return {
      type: 'github',
      owner: ghUrl[1],
      repo: ghUrl[2],
      ref: ghUrl[3],
      subpath: subpath ?? undefined,
      url: `https://github.com/${ghUrl[1]}/${ghUrl[2]}.git`,
      raw,
    };
  }

  const ssh = raw.match(GIT_SSH);
  if (ssh) {
    return {
      type: 'git',
      owner: ssh[2],
      repo: ssh[3],
      url: raw,
      raw,
    };
  }

  if (raw.startsWith('https://') || raw.startsWith('http://')) {
    return { type: 'git', url: raw, raw };
  }

  const shorthand = raw.match(GITHUB_SHORTHAND);
  if (shorthand) {
    const subpath = shorthand[3] ? sanitizeSubpath(shorthand[3]) : undefined;
    if (shorthand[3] && subpath === null) {
      throw new Error(`Unsafe subpath: ${raw}`);
    }
    return {
      type: 'github',
      owner: shorthand[1],
      repo: shorthand[2],
      subpath: subpath ?? undefined,
      url: `https://github.com/${shorthand[1]}/${shorthand[2]}.git`,
      raw,
    };
  }

  throw new Error(`Cannot parse source: '${raw}'. Expected: owner/repo, GitHub URL, git URL, or local path.`);
}

export function sourceLabel(source: ParsedSource): string {
  if (source.type === 'local') return source.localPath!;
  if (source.owner && source.repo) return `${source.owner}/${source.repo}`;
  return source.url ?? source.raw;
}
