import type { Scope } from '../types.js';
import { readGlobalLock } from '../lock/global.js';
import { readProjectLock } from '../lock/project.js';
import { install } from './install.js';
import * as log from '../util/log.js';

export interface UpdateArgs {
  names?: string[];
  scope?: Scope;
}

export async function update(args: UpdateArgs): Promise<void> {
  const projectDir = process.cwd();

  if (!args.scope || args.scope === 'global') {
    const lock = readGlobalLock();
    const entries = Object.entries(lock.skills);
    const filtered = args.names
      ? entries.filter(([name]) => args.names!.includes(name))
      : entries;

    if (filtered.length === 0 && (!args.scope || args.scope === 'global')) {
      log.info('No global skills to update.');
    }

    for (const [name, entry] of filtered) {
      log.info(`Updating ${name} from ${entry.source}...`);
      try {
        await install({
          source: entry.source,
          agents: entry.agents,
          scope: 'global',
        });
      } catch (err) {
        log.error(`Failed to update ${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (!args.scope || args.scope === 'project') {
    const lock = readProjectLock(projectDir);
    const entries = Object.entries(lock.skills);
    const filtered = args.names
      ? entries.filter(([name]) => args.names!.includes(name))
      : entries;

    if (filtered.length === 0 && args.scope === 'project') {
      log.info('No project skills to update.');
    }

    for (const [name, entry] of filtered) {
      log.info(`Updating ${name} from ${entry.source}...`);
      try {
        await install({
          source: entry.source,
          scope: 'project',
        });
      } catch (err) {
        log.error(`Failed to update ${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}
