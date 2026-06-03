import type { AgentAdapter } from '../types.js';
import claude from './claude.js';
import codex from './codex.js';
import cursor from './cursor.js';
import opencode from './opencode.js';
import hermes from './hermes.js';

export const ALL_AGENTS: AgentAdapter[] = [claude, codex, cursor, opencode, hermes];

const AGENT_MAP = new Map(ALL_AGENTS.map(a => [a.name, a]));

export function getAgent(name: string): AgentAdapter | undefined {
  return AGENT_MAP.get(name);
}

export function getAgentOrThrow(name: string): AgentAdapter {
  const agent = AGENT_MAP.get(name);
  if (!agent) {
    throw new Error(`Unknown agent '${name}'. Available: ${ALL_AGENTS.map(a => a.name).join(', ')}`);
  }
  return agent;
}

export async function detectInstalledAgents(): Promise<AgentAdapter[]> {
  const results = await Promise.all(
    ALL_AGENTS.map(async a => ({ agent: a, installed: await a.detectInstalled() }))
  );
  return results.filter(r => r.installed).map(r => r.agent);
}

export const ALL_AGENT_NAMES = ALL_AGENTS.map(a => a.name);
