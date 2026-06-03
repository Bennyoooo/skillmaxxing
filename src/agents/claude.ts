import * as path from 'node:path';
import * as os from 'node:os';
import type { AgentAdapter } from '../types.js';
import { fileExists } from '../util/fs.js';

const claude: AgentAdapter = {
  name: 'claude',
  displayName: 'Claude Code',
  cliCommand: 'claude',
  globalSkillsDir: path.join(os.homedir(), '.claude', 'skills'),
  projectSkillsDir: '.claude/skills',
  detectInstalled: async () => fileExists(path.join(os.homedir(), '.claude')),
};

export default claude;
