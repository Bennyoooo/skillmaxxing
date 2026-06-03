import * as path from 'node:path';
import * as os from 'node:os';
import type { AgentAdapter } from '../types.js';
import { fileExists } from '../util/fs.js';

const cursor: AgentAdapter = {
  name: 'cursor',
  displayName: 'Cursor',
  cliCommand: 'cursor',
  globalSkillsDir: path.join(os.homedir(), '.cursor', 'skills'),
  projectSkillsDir: '.cursor/skills',
  detectInstalled: async () => fileExists(path.join(os.homedir(), '.cursor')),
};

export default cursor;
