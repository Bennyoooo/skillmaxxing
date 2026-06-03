import * as path from 'node:path';
import * as os from 'node:os';
import type { AgentAdapter } from '../types.js';
import { fileExists } from '../util/fs.js';

const opencode: AgentAdapter = {
  name: 'opencode',
  displayName: 'OpenCode',
  cliCommand: 'opencode',
  globalSkillsDir: path.join(os.homedir(), '.config', 'opencode', 'skills'),
  projectSkillsDir: '.opencode/skills',
  detectInstalled: async () =>
    fileExists(path.join(os.homedir(), '.config', 'opencode')),
};

export default opencode;
