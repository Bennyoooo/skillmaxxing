#!/usr/bin/env node

import { install } from './commands/install.js';
import { discover } from './commands/discover.js';
import { list } from './commands/list.js';
import { remove } from './commands/remove.js';
import { update } from './commands/update.js';
import { init } from './commands/init.js';
import { doctor } from './commands/doctor.js';
import * as log from './util/log.js';
import type { Scope } from './types.js';

const VERSION = '0.1.0';

function parseFlags(argv: string[]): { positional: string[]; flags: Record<string, string | true> } {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.substring(2, eq)] = arg.substring(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith('-')) {
          flags[arg.substring(2)] = next;
          i++;
        } else {
          flags[arg.substring(2)] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const shortMap: Record<string, string> = { g: 'global', a: 'agent', s: 'scope', y: 'yes', h: 'help' };
      const long = shortMap[arg[1]] ?? arg[1];
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        flags[long] = next;
        i++;
      } else {
        flags[long] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function printHelp(): void {
  console.log(`skill-maxing v${VERSION}

A stack for installing, creating, improving, and governing AI agent skills.

Usage:
  skill-maxing <command> [options]

Commands:
  install <source>    Install skills from GitHub, URL, or local path
  discover <query>    Find skills by intent (curated index, repos, local)
  list                List installed skills
  remove <names...>   Remove installed skills
  update [names...]   Update installed skills to latest
  init [name]         Create a new skill template
  doctor              Check agent integrations and skill health

Options:
  -g, --global        Install/operate at global scope (default: project)
  -a, --agent <name>  Target specific agent (claude, codex, cursor, opencode, hermes)
  --copy              Force copy instead of symlink
  --force             Overwrite an existing unmanaged skill of the same name
  --repo <owner/repo> Extra repo source(s) to scan during discover (comma-sep)
  --limit <n>         Max discover results (default 20)
  --install <name>    Install a named result (discover command)
  --json              Output as JSON (list/discover commands)
  -y, --yes           Skip confirmation prompts
  -h, --help          Show help
  --version           Show version

Examples:
  skill-maxing install owner/repo              Install skills from GitHub
  skill-maxing install ./my-skills -g          Install local skills globally
  skill-maxing install owner/repo -a claude    Install for Claude Code only
  skill-maxing list                            List all installed skills
  skill-maxing list -g                         List global skills only
  skill-maxing remove my-skill                 Remove a skill
  skill-maxing update                          Update all installed skills
  skill-maxing init my-new-skill               Create a skill template
  skill-maxing doctor                          Check health
`);
}

async function main(): Promise<void> {
  const { positional, flags } = parseFlags(process.argv.slice(2));
  const command = positional[0];

  if (flags.version) {
    console.log(VERSION);
    return;
  }

  if (!command || flags.help) {
    printHelp();
    return;
  }

  const scope: Scope = flags.global === true ? 'global' : 'project';
  const agentFlag = typeof flags.agent === 'string' ? flags.agent : undefined;
  const agents = agentFlag ? agentFlag.split(',') : undefined;

  try {
    switch (command) {
      case 'install':
      case 'add':
      case 'i': {
        const source = positional[1];
        if (!source) {
          log.error('Usage: skill-maxing install <source>');
          process.exit(1);
        }
        await install({ source, agents, scope, copy: flags.copy === true, force: flags.force === true });
        break;
      }

      case 'discover':
      case 'search':
      case 'find': {
        const query = positional.slice(1).join(' ');
        if (!query) {
          log.error('Usage: skill-maxing discover "<what you want>" [--repo owner/repo] [--install <name>]');
          process.exit(1);
        }
        const repos = typeof flags.repo === 'string' ? flags.repo.split(',') : undefined;
        const limit = typeof flags.limit === 'string' ? parseInt(flags.limit, 10) : undefined;
        await discover({
          query,
          repos,
          json: flags.json === true,
          limit: Number.isNaN(limit) ? undefined : limit,
          install: typeof flags.install === 'string' ? flags.install : undefined,
          scope,
          agents,
          copy: flags.copy === true,
          force: flags.force === true,
        });
        break;
      }

      case 'list':
      case 'ls':
        await list({ agent: agentFlag, scope: flags.global === true ? 'global' : undefined, json: flags.json === true });
        break;

      case 'remove':
      case 'rm': {
        const names = positional.slice(1);
        if (names.length === 0) {
          log.error('Usage: skill-maxing remove <skill-name> [skill-name...]');
          process.exit(1);
        }
        await remove({ names, agent: agentFlag, scope: flags.global === true ? 'global' : undefined });
        break;
      }

      case 'update':
      case 'upgrade': {
        const names = positional.slice(1);
        await update({ names: names.length > 0 ? names : undefined, scope: flags.global === true ? 'global' : undefined });
        break;
      }

      case 'init': {
        const name = positional[1];
        await init({ name });
        break;
      }

      case 'doctor':
        await doctor();
        break;

      default:
        log.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
