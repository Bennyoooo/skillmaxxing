#!/usr/bin/env node
// Generates assets/hero.svg — a pixel-art rainbow "SKILLMAXXING" wordmark.
// Pure rects + fills so it renders reliably on GitHub. Re-run: node scripts/gen-hero.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const GLYPHS = {
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
};

const WORD = 'SKILLMAXXING';
const ROW_COLORS = ['#ff4d4d', '#ff9f1c', '#ffd23f', '#2ec27e', '#22b8cf', '#4d79ff', '#9b5de5'];
const PX = 16;
const PAD = 28;
const GAP = 1; // empty pixel columns between glyphs
const BG = '#10131c';
const GRID = '#0c0f17';
const TAGLINE = 'self-evolving skills for your coding agent';

const cols = WORD.length * 5 + (WORD.length - 1) * GAP;
const wordW = cols * PX;
const wordH = 7 * PX;
const width = wordW + PAD * 2;
const height = wordH + PAD * 2 + 48;

const rects = [];
let colOffset = 0;
for (const ch of WORD) {
  const g = GLYPHS[ch];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 5; c++) {
      if (g[r][c] !== '#') continue;
      const x = PAD + (colOffset + c) * PX;
      const y = PAD + r * PX;
      rects.push(
        `<rect x="${x}" y="${y}" width="${PX}" height="${PX}" fill="${ROW_COLORS[r]}" stroke="${GRID}" stroke-width="1"/>`,
      );
    }
  }
  colOffset += 5 + GAP;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="SKILLMAXXING">
  <rect width="${width}" height="${height}" rx="14" fill="${BG}"/>
  ${rects.join('\n  ')}
  <text x="${width / 2}" y="${PAD + wordH + 34}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" letter-spacing="2" fill="#8b93a7" text-anchor="middle">${TAGLINE}</text>
</svg>
`;

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'hero.svg'), svg);
console.log(`wrote assets/hero.svg (${width}x${height}, ${rects.length} pixels)`);
