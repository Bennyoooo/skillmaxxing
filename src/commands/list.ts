import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AgentAdapter, InstalledSkill, Scope } from '../types.js';
import { ALL_AGENTS } from '../agents/registry.js';
import { readSkillMeta } from '../util/frontmatter.js';
import { isSymlink } from '../util/fs.js';
import * as log from '../util/log.js';

export interface ListArgs {
  agent?: string;
  scope?: Scope;
  json?: boolean;
}

export async function list(args: ListArgs): Promise<void> {
  const projectDir = process.cwd();
  const skills: InstalledSkill[] = [];

  const agents = args.agent
    ? ALL_AGENTS.filter(a => a.name === args.agent)
    : ALL_AGENTS;

  for (const agent of agents) {
    if (!args.scope || args.scope === 'global') {
      skills.push(...scanDir(agent, agent.globalSkillsDir, 'global'));
    }
    if (!args.scope || args.scope === 'project') {
      const projDir = path.join(projectDir, agent.projectSkillsDir);
      skills.push(...scanDir(agent, projDir, 'project'));
    }
  }

  if (args.json) {
    console.log(JSON.stringify(skills, null, 2));
    return;
  }

  if (skills.length === 0) {
    log.info('No skills installed.');
    return;
  }

  log.heading(`Installed skills (${skills.length})`);
  const rows: string[][] = [['Name', 'Agent', 'Scope', 'Link', 'Description']];
  for (const s of skills) {
    rows.push([
      s.name,
      s.agent,
      s.scope,
      s.isSymlink ? 'sym' : 'copy',
      truncate(s.meta.description, 50),
    ]);
  }
  log.table(rows);
}

function scanDir(agent: AgentAdapter, dir: string, scope: Scope): InstalledSkill[] {
  const results: InstalledSkill[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const skillDir = path.join(dir, entry.name);
      const skillMd = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;

      const content = fs.readFileSync(skillMd, 'utf-8');
      const meta = readSkillMeta(content);
      if (!meta) continue;

      results.push({
        name: meta.name,
        meta,
        path: skillDir,
        agent: agent.name,
        scope,
        isSymlink: isSymlink(skillDir),
      });
    }
  } catch {
    // directory doesn't exist
  }
  return results;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.substring(0, max - 3) + '...';
}
