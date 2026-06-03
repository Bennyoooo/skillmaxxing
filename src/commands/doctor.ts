import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ALL_AGENTS } from '../agents/registry.js';
import { readGlobalLock } from '../lock/global.js';
import { isSymlink, fileExists } from '../util/fs.js';
import * as log from '../util/log.js';

const execFileAsync = promisify(execFile);

export async function doctor(): Promise<void> {
  log.heading('skill-maxing doctor');
  let issues = 0;

  log.heading('Agent Detection');
  for (const agent of ALL_AGENTS) {
    const installed = await agent.detectInstalled();
    const cliFound = await checkCli(agent.cliCommand);

    if (installed) {
      log.success(`${agent.displayName}: config directory found`);
    } else {
      log.dim(`${agent.displayName}: not installed`);
    }

    if (cliFound) {
      log.success(`${agent.displayName}: '${agent.cliCommand}' on PATH`);
    } else if (installed) {
      log.warn(`${agent.displayName}: config exists but '${agent.cliCommand}' not on PATH`);
    }
  }

  log.heading('Global Skills Health');
  const lock = readGlobalLock();
  const entries = Object.entries(lock.skills);

  if (entries.length === 0) {
    log.info('No global skills installed.');
  }

  for (const [name, entry] of entries) {
    for (const agentName of entry.agents) {
      const agent = ALL_AGENTS.find(a => a.name === agentName);
      if (!agent) {
        log.warn(`${name}: references unknown agent '${agentName}'`);
        issues++;
        continue;
      }

      const skillDir = path.join(agent.globalSkillsDir, name);
      if (!fileExists(skillDir)) {
        log.error(`${name}: missing at ${skillDir} (agent: ${agent.displayName})`);
        issues++;
        continue;
      }

      if (isSymlink(skillDir)) {
        const target = fs.readlinkSync(skillDir);
        const resolved = path.resolve(path.dirname(skillDir), target);
        if (!fileExists(resolved)) {
          log.error(`${name}: broken symlink → ${resolved} (agent: ${agent.displayName})`);
          issues++;
          continue;
        }
      }

      const skillMd = path.join(skillDir, 'SKILL.md');
      if (!fileExists(skillMd)) {
        log.warn(`${name}: directory exists but no SKILL.md (agent: ${agent.displayName})`);
        issues++;
        continue;
      }

      log.success(`${name}: OK (${agent.displayName})`);
    }
  }

  log.heading('Summary');
  if (issues === 0) {
    log.success('No issues found.');
  } else {
    log.warn(`${issues} issue(s) found. Run 'skill-maxing update' to fix stale installs.`);
  }
}

async function checkCli(command: string): Promise<boolean> {
  try {
    await execFileAsync('which', [command]);
    return true;
  } catch {
    return false;
  }
}
