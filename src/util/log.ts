const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';

export function info(msg: string): void {
  console.log(`${CYAN}i${RESET} ${msg}`);
}

export function success(msg: string): void {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

export function warn(msg: string): void {
  console.log(`${YELLOW}!${RESET} ${msg}`);
}

export function error(msg: string): void {
  console.error(`${RED}✗${RESET} ${msg}`);
}

export function heading(msg: string): void {
  console.log(`\n${BOLD}${msg}${RESET}`);
}

export function dim(msg: string): void {
  console.log(`${DIM}${msg}${RESET}`);
}

export function table(rows: string[][]): void {
  if (rows.length === 0) return;
  const widths = rows[0].map((_, i) =>
    Math.max(...rows.map(r => (r[i] ?? '').length))
  );
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(widths[i])).join('  '));
  }
}
