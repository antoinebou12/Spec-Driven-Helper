/** A 1200×630 SVG card summarising a specification: readiness, completeness, modules and stack. */
import { htmlEscape as esc } from './document-render';

export type OverviewInput = {
  name: string;
  subtitle: string;
  language: 'en' | 'fr';
  readiness: number;
  ready: boolean;
  completeness: number;
  modules: { title: string; done: number; total: number }[];
  stack: string[];
};

const clip = (v: string, max: number) => (v.length > max ? `${v.slice(0, max - 1)}…` : v);
const pct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function gauge(x: number, y: number, value: number, label: string, color: string) {
  const r = 62;
  const c = 2 * Math.PI * r;
  return `<g transform="translate(${x} ${y})">
<circle r="${r}" fill="none" stroke="#e7eaf0" stroke-width="14"/>
<circle r="${r}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${((c * pct(value)) / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90)"/>
<text y="10" text-anchor="middle" font-size="34" font-weight="700" fill="#1b2230">${pct(value)}%</text>
<text y="${r + 38}" text-anchor="middle" font-size="18" fill="#5d6675">${esc(label)}</text>
</g>`;
}

export function overviewSvg(input: OverviewInput): string {
  const fr = input.language === 'fr';
  const modules = input.modules.slice(0, 14);
  const rows = Math.ceil(modules.length / 2);
  const bars = modules
    .map((m, i) => {
      const col = i < rows ? 0 : 1;
      const x = 440 + col * 370;
      const y = 196 + (i % rows) * 44;
      const ratio = m.total ? m.done / m.total : 0;
      const fill = ratio >= 1 ? '#1f9d6b' : ratio > 0 ? '#2f5bd3' : '#c3c9d4';
      return `<g transform="translate(${x} ${y})">
<text font-size="15" fill="#1b2230">${esc(clip(m.title, 30))}</text>
<text x="330" text-anchor="end" font-size="14" fill="#5d6675">${m.done}/${m.total}</text>
<rect y="8" width="330" height="8" rx="4" fill="#e7eaf0"/>
<rect y="8" width="${(330 * ratio).toFixed(1)}" height="8" rx="4" fill="${fill}"/>
</g>`;
    })
    .join('\n');
  let cursor = 60;
  const chips: string[] = [];
  for (const name of input.stack) {
    const text = clip(name, 22);
    const width = 22 + text.length * 8.4;
    if (cursor + width > 1140) break;
    chips.push(
      `<g transform="translate(${cursor.toFixed(1)} 548)"><rect width="${width.toFixed(1)}" height="34" rx="17" fill="#eef2fd"/><text x="${(width / 2).toFixed(1)}" y="22" text-anchor="middle" font-size="15" fill="#2449b0">${esc(text)}</text></g>`,
    );
    cursor += width + 10;
  }
  const status = input.ready ? (fr ? 'Prêt pour une référence' : 'Ready for baseline') : fr ? 'En cours' : 'In progress';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc" font-family="'Segoe UI', system-ui, -apple-system, Arial, sans-serif">
<title id="title">${esc(input.name)}</title>
<desc id="desc">${esc(`${fr ? 'Préparation' : 'Readiness'} ${pct(input.readiness)}%, ${fr ? 'complétude' : 'completeness'} ${pct(input.completeness)}%`)}</desc>
<defs><linearGradient id="band" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#2f5bd3"/><stop offset="1" stop-color="#6a4fd8"/></linearGradient></defs>
<rect width="1200" height="630" fill="#ffffff"/>
<rect width="1200" height="132" fill="url(#band)"/>
<text x="60" y="56" font-size="16" letter-spacing="2" fill="#dfe6ff">SDD STUDIO</text>
<text x="60" y="98" font-size="36" font-weight="700" fill="#ffffff">${esc(clip(input.name, 52))}</text>
<text x="1140" y="56" text-anchor="end" font-size="16" fill="#dfe6ff">${esc(clip(input.subtitle, 60))}</text>
<g transform="translate(1140 82)"><rect x="-190" width="190" height="32" rx="16" fill="${input.ready ? '#1f9d6b' : '#ffffff'}" fill-opacity="${input.ready ? 1 : 0.18}"/><text x="-95" y="21" text-anchor="middle" font-size="15" font-weight="600" fill="#ffffff">${esc(status)}</text></g>
${gauge(150, 280, input.readiness, fr ? 'Préparation' : 'Readiness', input.ready ? '#1f9d6b' : '#2f5bd3')}
${gauge(320, 280, input.completeness, fr ? 'Complétude' : 'Completeness', '#6a4fd8')}
<text x="440" y="172" font-size="14" letter-spacing="1.5" fill="#5d6675">${fr ? 'MODULES (RÉPONSES OBLIGATOIRES)' : 'MODULES (REQUIRED ANSWERS)'}</text>
${bars}
<line x1="60" x2="1140" y1="516" y2="516" stroke="#e7eaf0"/>
<text x="60" y="538" font-size="14" letter-spacing="1.5" fill="#5d6675">${fr ? 'PILE TECHNIQUE' : 'TECH STACK'}</text>
${chips.join('\n') || `<text x="60" y="570" font-size="15" fill="#8a93a3">${fr ? 'Aucune technologie choisie' : 'No technology chosen yet'}</text>`}
</svg>
`;
}
