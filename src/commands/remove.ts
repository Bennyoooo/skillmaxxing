import * as path from 'node:path';
import type { Scope } from '../types.js';
import { ALL_AGENTS, getAgentOrThrow } from '../agents/registry.js';
import { removeDir, fileExists } from '../util/fs.js';
import { removeGlobalLockEntry } from '../lock/global.js';
import { removeProjectLockEntry } from '../lock/project.js';
import * as log from '../util/log.js';

export interface RemoveArgs {
  names: string[];
  agent?: string;
  scope?: Scope;
}

export async function remove(args: RemoveArgs): Promise<void> {
  if (args.names.length === 0) {
    log.error('Specify at least one skill name to remove.');
    return;
  }

  const agents = args.agent
    ? [getAgentOrThrow(args.agent)]
    : ALL_AGENTS;

  const projectDir = process.cwd();
  let removed = 0;

  for (const name of args.names) {
    let found = false;
    for (const agent of agents) {
      const dirs: { path: string; scope: Scope }[] = [];

      if (!args.scope || args.scope === 'global') {
        dirs.push({ path: path.join(agent.globalSkillsDir, name), scope: 'global' });
      }
      if (!args.scope || args.scope === 'project') {
        dirs.push({ path: path.join(projectDir, agent.projectSkillsDir, name), scope: 'project' });
      }

      for (const d of dirs) {
        if (fileExists(d.path) && removeDir(d.path)) {
          log.success(`Removed ${name} from ${agent.displayName} (${d.scope})`);
          found = true;
        }
      }
    }

    if (found) {
      removed++;
      if (!args.scope || args.scope === 'global') removeGlobalLockEntry(name);
      if (!args.scope || args.scope === 'project') removeProjectLockEntry(projectDir, name);
    } else {
      log.warn(`Skill '${name}' not found in any agent.`);
    }
  }

  if (removed > 0) {
    log.success(`Removed ${removed} skill(s)`);
  }
}
