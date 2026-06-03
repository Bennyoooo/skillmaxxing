import * as path from 'node:path';
import * as os from 'node:os';
import type { AgentAdapter } from '../types.js';
import { fileExists } from '../util/fs.js';

const codex: AgentAdapter = {
  name: 'codex',
  displayName: 'OpenAI Codex CLI',
  cliCommand: 'codex',
  globalSkillsDir: path.join(os.homedir(), '.codex', 'skills'),
  projectSkillsDir: '.agents/skills',
  detectInstalled: async () => fileExists(path.join(os.homedir(), '.codex')),
};

export default codex;
