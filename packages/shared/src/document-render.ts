/**
 * Document rendering for exports: a small parser for the Markdown SDD Studio writes (headings,
 * paragraphs, lists, tables, code fences, quotes, rules, and inline code, bold, emphasis and links)
 * and renderers for LaTeX and standalone HTML. All text is escaped; only http(s) and mailto links
 * survive, so imported content cannot inject markup or scripts.
 */
export type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'quote'; text: string }
  | { type: 'rule' };

const fenceRe = /^\s*(```|~~~)\s*([\w+-]*)\s*$/;
const headingRe = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const ruleRe = /^\s*([-*_])(\s*\1){2,}\s*$/;
const itemRe = /^\s*([-*+]|\d+[.)])\s+(.*)$/;
const rowRe = /^\s*\|.*\|\s*$/;
const separatorRe = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));

function startsBlock(lines: string[], i: number) {
  const line = lines[i];
  return (
    fenceRe.test(line) ||
    headingRe.test(line) ||
    ruleRe.test(line) ||
    itemRe.test(line) ||
    /^\s*>/.test(line) ||
    (rowRe.test(line) && i + 1 < lines.length && separatorRe.test(lines[i + 1]))
  );
}

export function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = fenceRe.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', lang: fence[2], text: body.join('\n') });
      continue;
    }
    const heading = headingRe.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (ruleRe.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }
    if (rowRe.test(line) && i + 1 < lines.length && separatorRe.test(lines[i + 1])) {
      const header = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && rowRe.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push({ type: 'quote', text: quote.join(' ').trim() });
      continue;
    }
    const item = itemRe.exec(line);
    if (item) {
      const ordered = /\d/.test(item[1]);
      const items: string[] = [];
      while (i < lines.length) {
        const next = itemRe.exec(lines[i]);
        if (next && /\d/.test(next[1]) === ordered) items.push(next[2]);
        else if (items.length && /^\s{2,}\S/.test(lines[i]) && !next) items[items.length - 1] += ` ${lines[i].trim()}`;
        else break;
        i++;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && (!paragraph.length || !startsBlock(lines, i))) paragraph.push(lines[i++].trim());
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}

type Inline = { kind: 'text' | 'code' | 'bold' | 'em'; text: string } | { kind: 'link'; text: string; url: string };
const inlineRe = /`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|\*(?![\s*])(.+?)\*|(?<![\w])_(?![\s_])(.+?)_(?!\w)|\[([^\]]+)\]\(([^)\s]+)\)/g;
export const safeUrl = (url: string) => /^(https?:\/\/|mailto:)/i.test(url);

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(inlineRe)) {
    if (m.index! > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: 'code', text: m[1] });
    else if (m[2] !== undefined || m[3] !== undefined) out.push({ kind: 'bold', text: m[2] ?? m[3] });
    else if (m[4] !== undefined || m[5] !== undefined) out.push({ kind: 'em', text: m[4] ?? m[5] });
    else if (safeUrl(m[7])) out.push({ kind: 'link', text: m[6], url: m[7] });
    else out.push({ kind: 'text', text: m[6] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

// LaTeX ------------------------------------------------------------------------------------------

export const texEscape = (v: string) =>
  v.replace(
    /[\\{}$&#%_^~<>|]/g,
    (c) =>
      ({
        '\\': '\\textbackslash{}',
        '{': '\\{',
        '}': '\\}',
        $: '\\$',
        '&': '\\&',
        '#': '\\#',
        '%': '\\%',
        _: '\\_',
        '^': '\\textasciicircum{}',
        '~': '\\textasciitilde{}',
        '<': '\\textless{}',
        '>': '\\textgreater{}',
        '|': '\\textbar{}',
      })[c]!,
  );
const urlEscape = (url: string) => url.replace(/[\\{}%#]/g, (c) => `\\${c}`);

function inlineLatex(text: string) {
  return parseInline(text)
    .map((t) => {
      if (t.kind === 'code') return `\\texttt{${texEscape(t.text)}}`;
      if (t.kind === 'bold') return `\\textbf{${texEscape(t.text)}}`;
      if (t.kind === 'em') return `\\emph{${texEscape(t.text)}}`;
      if (t.kind === 'link') return `\\href{${urlEscape(t.url)}}{${texEscape(t.text)}}`;
      return texEscape(t.text);
    })
    .join('');
}

const latexHeading = ['section', 'section', 'section', 'subsection', 'subsubsection', 'paragraph', 'paragraph'];

/** LaTeX body for Markdown, placed inside a \chapter: `#` and `##` become \section. */
export function markdownToLatex(markdown: string, { dropTitle = false } = {}): string {
  const blocks = parseMarkdown(markdown);
  if (dropTitle && blocks[0]?.type === 'heading' && blocks[0].level === 1) blocks.shift();
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
          return `\\${latexHeading[b.level]}{${inlineLatex(b.text)}}`;
        case 'paragraph':
          return inlineLatex(b.text);
        case 'list': {
          const env = b.ordered ? 'enumerate' : 'itemize';
          return `\\begin{${env}}\n${b.items.map((x) => `  \\item ${inlineLatex(x)}`).join('\n')}\n\\end{${env}}`;
        }
        case 'table': {
          const n = Math.max(b.header.length, ...b.rows.map((r) => r.length));
          const width = (0.96 / n).toFixed(3);
          const row = (r: string[], head = false) =>
            Array.from({ length: n }, (_, k) => (head ? `\\textbf{${inlineLatex(r[k] ?? '')}}` : inlineLatex(r[k] ?? ''))).join(' & ') + ' \\\\';
          return `\\begin{longtable}{@{}${`>{\\raggedright\\arraybackslash}p{${width}\\linewidth}`.repeat(n)}@{}}\n\\toprule\n${row(b.header, true)}\n\\midrule\n\\endhead\n${b.rows.map((r) => row(r)).join('\n')}\n\\bottomrule\n\\end{longtable}`;
        }
        case 'code':
          return `${b.lang ? `\\noindent\\textit{${texEscape(b.lang)}}\n` : ''}\\begin{verbatim}\n${b.text.replace(/\\end\{verbatim\}/g, '\\end {verbatim}')}\n\\end{verbatim}`;
        case 'quote':
          return `\\begin{quote}\n${inlineLatex(b.text)}\n\\end{quote}`;
        case 'rule':
          return '\\noindent\\rule{\\linewidth}{0.4pt}';
      }
    })
    .join('\n\n');
}

export type RenderedDocument = {
  title: string;
  subtitle?: string;
  language: 'en' | 'fr';
  meta: [label: string, value: string][];
  chapters: { id: string; title: string; markdown: string }[];
};

/** A complete report. Compile with XeLaTeX or LuaLaTeX (fontspec handles Unicode text). */
export function latexDocument(doc: RenderedDocument): string {
  const fr = doc.language === 'fr';
  return [
    '% Generated by SDD Studio. Compile with xelatex or lualatex.',
    '\\documentclass[11pt,a4paper]{report}',
    '\\usepackage{fontspec}',
    `\\usepackage{polyglossia}\n\\setdefaultlanguage{${fr ? 'french' : 'english'}}`,
    '\\usepackage[margin=2.4cm]{geometry}',
    '\\usepackage{array,longtable,booktabs}',
    '\\usepackage{xcolor}',
    '\\usepackage[colorlinks=true,linkcolor=blue!50!black,urlcolor=blue!60!black]{hyperref}',
    '\\setlength{\\parskip}{0.5em}\n\\setlength{\\parindent}{0pt}',
    `\\title{${texEscape(doc.title)}${doc.subtitle ? `\\\\[0.5em]\\large ${texEscape(doc.subtitle)}` : ''}}`,
    '\\author{SDD Studio}',
    '\\date{}',
    '\\begin{document}',
    '\\maketitle',
    doc.meta.length
      ? `\\begin{center}\n\\begin{tabular}{@{}ll@{}}\n\\toprule\n${doc.meta.map(([k, v]) => `\\textbf{${texEscape(k)}} & ${texEscape(v)} \\\\`).join('\n')}\n\\bottomrule\n\\end{tabular}\n\\end{center}`
      : '',
    '\\tableofcontents',
    ...doc.chapters.map((c) => `\\chapter{${texEscape(c.title)}}\\label{${c.id.replace(/[^\w-]/g, '')}}\n\n${markdownToLatex(c.markdown, { dropTitle: true })}`),
    '\\end{document}',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

// HTML -------------------------------------------------------------------------------------------

export const htmlEscape = (v: string) =>
  v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function inlineHtml(text: string) {
  return parseInline(text)
    .map((t) => {
      if (t.kind === 'code') return `<code>${htmlEscape(t.text)}</code>`;
      if (t.kind === 'bold') return `<strong>${htmlEscape(t.text)}</strong>`;
      if (t.kind === 'em') return `<em>${htmlEscape(t.text)}</em>`;
      if (t.kind === 'link') return `<a href="${htmlEscape(t.url)}" rel="noreferrer">${htmlEscape(t.text)}</a>`;
      return htmlEscape(t.text);
    })
    .join('');
}

export function markdownToHtml(markdown: string, { dropTitle = false, headingOffset = 0 } = {}): string {
  const blocks = parseMarkdown(markdown);
  if (dropTitle && blocks[0]?.type === 'heading' && blocks[0].level === 1) blocks.shift();
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'heading': {
          const level = Math.min(6, b.level + headingOffset);
          return `<h${level}>${inlineHtml(b.text)}</h${level}>`;
        }
        case 'paragraph':
          return `<p>${inlineHtml(b.text)}</p>`;
        case 'list': {
          const tag = b.ordered ? 'ol' : 'ul';
          return `<${tag}>${b.items.map((x) => `<li>${inlineHtml(x)}</li>`).join('')}</${tag}>`;
        }
        case 'table':
          return `<div class="table"><table><thead><tr>${b.header.map((h) => `<th scope="col">${inlineHtml(h)}</th>`).join('')}</tr></thead><tbody>${b.rows
            .map((r) => `<tr>${b.header.map((_, k) => `<td>${inlineHtml(r[k] ?? '')}</td>`).join('')}</tr>`)
            .join('')}</tbody></table></div>`;
        case 'code':
          return `<pre${b.lang ? ` data-lang="${htmlEscape(b.lang)}"` : ''}><code>${htmlEscape(b.text)}</code></pre>`;
        case 'quote':
          return `<blockquote>${inlineHtml(b.text)}</blockquote>`;
        case 'rule':
          return '<hr>';
      }
    })
    .join('\n');
}

const htmlStyles = `
:root{color-scheme:light;--text:#1b2230;--muted:#5d6675;--line:#e2e5ea;--subtle:#f5f6f8;--accent:#2f5bd3}
*{box-sizing:border-box}
body{margin:0;font:15px/1.6 'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;color:var(--text);background:#fff}
main{max-width:860px;margin:0 auto;padding:40px 28px}
.cover{padding:48px 0 28px;border-bottom:3px solid var(--accent);margin-bottom:28px}
.eyebrow{text-transform:uppercase;letter-spacing:.08em;color:var(--accent);font-weight:600;font-size:12px;margin:0}
.cover h1{font-size:34px;line-height:1.2;margin:8px 0}
.meta{border-collapse:collapse;margin-top:16px}.meta th{text-align:left;color:var(--muted);font-weight:600;padding:2px 16px 2px 0}.meta td{padding:2px 0}
nav ol{columns:2;padding-left:20px}nav a{color:inherit}
section{padding-top:8px}
section>h1{font-size:24px;border-bottom:1px solid var(--line);padding-bottom:6px;margin-top:40px}
h2{font-size:18px;margin-top:28px}h3{font-size:16px}
a{color:var(--accent)}
code{font-family:ui-monospace,'Cascadia Code',Consolas,monospace;font-size:.88em;background:var(--subtle);padding:1px 4px;border-radius:4px}
pre{background:var(--subtle);border:1px solid var(--line);border-radius:10px;padding:12px 14px;overflow-x:auto;white-space:pre-wrap}
pre code{background:none;padding:0}
pre[data-lang]::before{content:attr(data-lang);display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px}
blockquote{margin:12px 0;padding:6px 14px;border-left:3px solid var(--accent);color:var(--muted);background:var(--subtle);border-radius:0 8px 8px 0}
.table{overflow-x:auto;margin:12px 0 18px}
table{border-collapse:separate;border-spacing:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;min-width:60%}
th,td{padding:7px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
th+th,td+td{border-left:1px solid var(--line)}
thead th{background:var(--subtle);font-size:12px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted)}
tbody tr:nth-child(even) td{background:#fafbfc}tbody tr:last-child td{border-bottom:0}
.print-hint{margin:0 0 20px;padding:10px 14px;border-radius:10px;background:#eef2fd;color:#2449b0;font-size:13px}
footer{margin-top:48px;color:var(--muted);font-size:12px;border-top:1px solid var(--line);padding-top:12px}
@page{size:A4;margin:18mm 16mm}
@media print{main{max-width:none;padding:0}.print-hint{display:none}section{break-before:page}thead{display:table-header-group}tr,pre,blockquote{break-inside:avoid}a{color:inherit;text-decoration:none}}
`;

/** A standalone, print-ready HTML document (no scripts, no external resources). */
export function htmlDocument(doc: RenderedDocument): string {
  const fr = doc.language === 'fr';
  const anchor = (id: string) => `section-${id.replace(/[^\w-]/g, '')}`;
  return `<!doctype html>
<html lang="${doc.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="SDD Studio">
<title>${htmlEscape(doc.title)}</title>
<style>${htmlStyles}</style>
</head>
<body>
<main>
<p class="print-hint">${fr ? 'Pour un PDF : Imprimer puis « Enregistrer au format PDF ».' : 'For a PDF: Print, then “Save as PDF”.'}</p>
<header class="cover">
<p class="eyebrow">${fr ? 'Document de conception logicielle' : 'Software design document'}</p>
<h1>${htmlEscape(doc.title)}</h1>
${doc.subtitle ? `<p>${htmlEscape(doc.subtitle)}</p>` : ''}
<table class="meta">${doc.meta.map(([k, v]) => `<tr><th scope="row">${htmlEscape(k)}</th><td>${htmlEscape(v)}</td></tr>`).join('')}</table>
</header>
<nav aria-labelledby="toc-title"><h2 id="toc-title">${fr ? 'Sommaire' : 'Contents'}</h2><ol>${doc.chapters
    .map((c) => `<li><a href="#${anchor(c.id)}">${htmlEscape(c.title)}</a></li>`)
    .join('')}</ol></nav>
${doc.chapters
  .map((c, i) => `<section id="${anchor(c.id)}" aria-labelledby="${anchor(c.id)}-title"><h1 id="${anchor(c.id)}-title">${i + 1}. ${htmlEscape(c.title)}</h1>\n${markdownToHtml(c.markdown, { dropTitle: true })}</section>`)
  .join('\n')}
<footer>${fr ? 'Généré par SDD Studio.' : 'Generated by SDD Studio.'}</footer>
</main>
</body>
</html>
`;
}
