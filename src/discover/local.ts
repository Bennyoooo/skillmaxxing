import * as fs from 'node:fs';
import * as path from 'node:path';
import { ALL_AGENTS } from '../agents/registry.js';
import { readSkillMeta } from '../util/frontmatter.js';
import { fileExists } from '../util/fs.js';
import { isSafeEntryName } from '../source/resolver.js';
import type { DiscoveryCandidate } from './types.js';

/**
 * Scan every agent's global and project skill dirs for installed skills,
 * de-duplicated by name. Best-effort: unreadable dirs and malformed SKILL.md
 * files are skipped, never fatal.
 */
export function scanLocalSkills(projectDir = process.cwd()): DiscoveryCandidate[] {
  const seen = new Set<string>();
  const out: DiscoveryCandidate[] = [];

  for (const agent of ALL_AGENTS) {
    const dirs = [agent.globalSkillsDir, path.join(projectDir, agent.projectSkillsDir)];
    for (const dir of dirs) {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        if (!isSafeEntryName(entry.name)) continue;
        const skillMd = path.join(dir, entry.name, 'SKILL.md');
        if (!fileExists(skillMd)) continue;
        let meta;
        try {
          meta = readSkillMeta(fs.readFileSync(skillMd, 'utf-8'));
        } catch {
          continue;
        }
        if (!meta || seen.has(meta.name)) continue;
        seen.add(meta.name);
        out.push({
          name: meta.name,
          description: meta.description,
          source: '',
          origin: 'local',
          tags: Array.isArray(meta.tags) ? meta.tags : [],
          installed: true,
        });
      }
    }
  }
  return out;
}
