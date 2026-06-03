import * as path from 'node:path';
import * as os from 'node:os';
import type { AgentAdapter } from '../types.js';
import { fileExists } from '../util/fs.js';

const hermes: AgentAdapter = {
  name: 'hermes',
  displayName: 'Hermes Agent',
  cliCommand: 'hermes',
  globalSkillsDir: path.join(os.homedir(), '.hermes', 'skills'),
  projectSkillsDir: '.hermes/skills',
  detectInstalled: async () => fileExists(path.join(os.homedir(), '.hermes')),
};

export default hermes;
