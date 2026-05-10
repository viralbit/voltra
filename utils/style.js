/**
 * VOLTRA MD — Quantum Boxed UI v3
 *
 * Renders messages in this style:
 *
 *   ╔════════════════════╗
 *      🛰️ *VOLTRA MD*
 *   ╚════════════════════╝
 *
 *   ┌────────────────────┐
 *   │ 👋 *User:* drey
 *   │ ⚡ *Prefix:* [ . ]
 *   └────────────────────┘
 *
 *   ⫹⫺ *SECTION*
 *   ┃ 📋 .menu
 *   ┃ ❓ .help
 *   ┗━━━━━━━━━━━━━━━━━━━━▣
 */

const TOP    = '╔════════════════════╗';
const BOT    = '╚════════════════════╝';
const CARD_T = '┌────────────────────┐';
const CARD_B = '└────────────────────┘';
const SEC_FT = '┗━━━━━━━━━━━━━━━━━━━━▣';

function quantumHeader(title) {
  const t = String(title || 'VOLTRA MD').toUpperCase();
  return `${TOP}\n   🛰️ *${t}*\n${BOT}`;
}

function infoCard(lines = []) {
  const body = (Array.isArray(lines) ? lines : [String(lines)])
    .filter(Boolean)
    .map(l => `│ ${l}`)
    .join('\n');
  return `${CARD_T}\n${body}\n${CARD_B}`;
}

function quantumSection(title, lines = []) {
  const safe = (Array.isArray(lines) ? lines : [String(lines)]).filter(Boolean);
  const body = safe.map(l => `┃ ${l}`).join('\n');
  return `⫹⫺ *${String(title || '').toUpperCase()}*\n${body}\n${SEC_FT}`;
}

/**
 * Build a multi-section quantum layout.
 *   sections = [
 *     { kind: 'header', title: 'VOLTRA MD' },
 *     { kind: 'card',   lines: ['👋 *User:* drey'] },
 *     { kind: 'section', title: 'SYSTEM', lines: ['📋 .menu'] }
 *   ]
 */
function quantumLayout(sections = []) {
  const out = [];
  for (const s of sections.filter(Boolean)) {
    if (s.kind === 'header') out.push(quantumHeader(s.title));
    else if (s.kind === 'card') out.push(infoCard(s.lines || []));
    else out.push(quantumSection(s.title, s.lines || []));
  }
  return out.join('\n\n');
}

/**
 * formatViralUI(title, lines) — legacy single block.
 * Renders a header + card + bottom tag for backwards compatibility.
 */
function formatViralUI(title, lines) {
  return quantumLayout([
    { kind: 'header', title },
    { kind: 'card', lines: Array.isArray(lines) ? lines : [String(lines || '')] },
    { kind: 'section', title: 'VOLTRA ENGINE', lines: ['📡 v3.0 · QUANTUM CORE'] },
  ]);
}

/** Legacy multi-section API used by existing commands. */
function multiBox(sections = []) {
  // First section becomes header+card; rest become quantum sections.
  const layout = [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (!s) continue;
    if (i === 0) {
      layout.push({ kind: 'header', title: s.title });
      if (s.lines && s.lines.length) layout.push({ kind: 'card', lines: s.lines });
    } else {
      layout.push({ kind: 'section', title: s.title, lines: s.lines || [] });
    }
  }
  return quantumLayout(layout);
}

// ---------- Legacy shims ----------
function header(opts = {}) {
  const { pushName, totalCommands, title } = opts;
  const lines = [];
  if (pushName) lines.push(`👋 *User:* ${String(pushName).split('@')[0]}`);
  if (typeof totalCommands === 'number') lines.push(`📦 *Commands:* ${totalCommands}`);
  return formatViralUI(title || 'VOLTRA MD', lines);
}
function section(title, rows = []) {
  return quantumSection(title, Array.isArray(rows) ? rows : [String(rows)]);
}
function footer(label = 'VOLTRA MD') {
  return quantumHeader(label);
}
function styled({ pushName, title, sections = [] } = {}) {
  const layout = [{ kind: 'header', title: title || 'VOLTRA MD' }];
  if (pushName) layout.push({ kind: 'card', lines: [`👋 *User:* ${String(pushName).split('@')[0]}`] });
  for (const s of sections) {
    if (s && Array.isArray(s.rows)) layout.push({ kind: 'section', title: s.title, lines: s.rows });
  }
  return quantumLayout(layout);
}

module.exports = {
  formatViralUI,
  multiBox,
  quantumLayout,
  quantumHeader,
  quantumSection,
  infoCard,
  header,
  section,
  footer,
  styled,
};
