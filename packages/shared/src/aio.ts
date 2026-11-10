import { features } from './features';
import { featureFlags } from './feature-flags';
import { modules } from './templates';

/**
 * AI optimisation (AIO): what AI assistants, answer engines and crawlers read about SDD Studio.
 * One source for llms.txt, llms-full.txt, robots.txt, sitemap.xml, the JSON-LD in index.html and
 * the no-JavaScript summary, so every claim matches the working product (see features.ts).
 * Private data never appears here: everything under /api and inside projects stays out of reach.
 */
export const site = {
  name: 'SDD Studio',
  tagline: 'Design, review and publish your software specification.',
  summary:
    'SDD Studio is a self-hosted workspace for writing software design documents (SDD). A guided interview covers 14 modules in English and French; answers become editable Markdown with diagrams, traceability, readiness checks and immutable baselines. AI assistants propose changes that people review, and the approved specification is handed to developers and coding agents as Markdown, JSON, a .plan folder, Git pull requests or an MCP server.',
  license: 'Self-hosted; bring your own AI provider (OpenAI, Anthropic, NVIDIA NIM or a local Ollama model).',
} as const;

/** Questions people ask assistants about the product, answered only with verifiable facts. */
export const faq = [
  {
    q: { en: 'What is SDD Studio?', fr: 'Qu’est-ce que SDD Studio ?' },
    a: {
      en: 'A self-hosted workspace for writing, reviewing and publishing software design documents. It guides a team through 14 documentation modules, from business goals to operations and governance, in English or French.',
      fr: 'Un espace auto-hébergé pour rédiger, réviser et publier des documents de conception logicielle, qui guide l’équipe à travers 14 modules en français ou en anglais.',
    },
  },
  {
    q: { en: 'Does the AI change my specification?', fr: 'L’IA modifie-t-elle ma spécification ?' },
    a: {
      en: 'No. AI runs, imports and coding agents only create proposals. A person with review rights accepts or rejects each one, and approved baselines never change.',
      fr: 'Non. L’IA, les imports et les agents créent seulement des propositions ; une personne autorisée les accepte ou les refuse, et les références approuvées ne changent jamais.',
    },
  },
  {
    q: { en: 'Can it run without cloud AI?', fr: 'Fonctionne-t-il sans IA infonuagique ?' },
    a: {
      en: 'Yes. Projects marked local-only use a local Ollama model and never fall back to cloud providers or external diagram renderers.',
      fr: 'Oui. Les projets locaux utilisent un modèle Ollama local et ne basculent jamais vers un fournisseur infonuagique.',
    },
  },
  {
    q: { en: 'How do coding agents use the specification?', fr: 'Comment les agents de code utilisent-ils la spécification ?' },
    a: {
      en: 'Through a .plan folder with AGENTS.md and CLAUDE.md, or through the built-in MCP server: agents read the specification and board, move cards, link pull requests and propose changes for review.',
      fr: 'Par un dossier .plan avec AGENTS.md et CLAUDE.md, ou par le serveur MCP intégré : les agents lisent la spécification et le tableau, déplacent des cartes et proposent des changements.',
    },
  },
  {
    q: { en: 'How is it deployed?', fr: 'Comment est-il déployé ?' },
    a: {
      en: 'With Docker Compose (PostgreSQL with pgvector, the app and a worker) or as separate API and web images; Prometheus, Grafana and Netdata can be added for monitoring.',
      fr: 'Avec Docker Compose (PostgreSQL avec pgvector, l’application et un travailleur) ou des images API et web séparées ; Prometheus, Grafana et Netdata sont optionnels.',
    },
  },
] as const;

const featureList = () => [
  ...features.map((f) => `${f.en}: ${f.detail}`),
  ...featureFlags.map((f) => `${f.label.en}: ${f.description.en}`),
];

/** https://llmstxt.org — a short Markdown map of the site for language models. */
export function llmsTxt(origin: string) {
  const link = (path: string, title: string, note: string) => `- [${title}](${origin}${path}): ${note}`;
  return `# ${site.name}

> ${site.summary}

${site.name} is used by software teams to agree on what to build before building it. The public site is the sign-in page; everything inside a workspace is private.

## Product

${features.map((f) => `- **${f.en}** — ${f.detail}`).join('\n')}

## Documentation

${link('/llms-full.txt', 'Full product description', 'features, modules, FAQ and the agent (MCP) tools in one text file')}
${link('/api/docs', 'API reference', 'OpenAPI 3.1 for every route (sign-in required)')}

## Optional

${link('/sitemap.xml', 'Sitemap', 'public pages')}
`;
}

/** Longer, self-contained description for assistants that fetch one file. */
export function llmsFullTxt(origin: string, mcpTools: { name: string; description: string }[] = []) {
  return `# ${site.name}

> ${site.summary}

Website: ${origin}/
License and hosting: ${site.license}

## Features

${featureList().map((f) => `- ${f}`).join('\n')}

## The 14 specification modules

${modules.map((m, i) => `${i + 1}. **${m.title.en}** — ${m.description.en}`).join('\n')}

## Frequently asked questions

${faq.map((f) => `### ${f.q.en}\n\n${f.a.en}`).join('\n\n')}
${mcpTools.length ? `\n## MCP tools for coding agents\n\nEndpoint: ${origin}/api/v1/mcp (Streamable HTTP, project token).\n\n${mcpTools.map((t) => `- \`${t.name}\` — ${t.description.split('. ')[0].replace(/\.$/, '')}.`).join('\n')}\n` : ''}`;
}

/** Well-known AI crawlers; they may read the public pages and the llms files, never /api. */
export const aiCrawlers = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'] as const;

export function robotsTxt(origin: string, allowAi = true) {
  const rules = (agent: string, allow: boolean) =>
    allow ? `User-agent: ${agent}\nAllow: /\nDisallow: /api/` : `User-agent: ${agent}\nDisallow: /`;
  return `${[rules('*', true), ...aiCrawlers.map((a) => rules(a, allowAi))].join('\n\n')}\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export function sitemapXml(origin: string) {
  const urls = ['/', '/llms.txt', '/llms-full.txt'];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${origin}${u}</loc></url>`).join('\n')}\n</urlset>\n`;
}

/** schema.org graph for the public page: the application, the site and the FAQ. */
export function structuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        '@id': '#app',
        name: site.name,
        description: site.summary,
        applicationCategory: 'DeveloperApplication',
        applicationSubCategory: 'Software design documentation',
        operatingSystem: 'Linux, Windows, macOS (Docker or Node.js 24)',
        inLanguage: ['en', 'fr'],
        featureList: featureList(),
      },
      { '@type': 'WebSite', '@id': '#site', name: site.name, description: site.tagline, inLanguage: ['en', 'fr'], about: { '@id': '#app' } },
      {
        '@type': 'FAQPage',
        '@id': '#faq',
        mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q.en, acceptedAnswer: { '@type': 'Answer', text: f.a.en } })),
      },
    ],
  };
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Head and body additions for index.html: meta, Open Graph, JSON-LD and a no-JavaScript summary. */
export function indexHtmlAdditions() {
  const json = JSON.stringify(structuredData()).replace(/</g, '\\u003c');
  const head = [
    `<meta name="robots" content="index, follow, max-snippet:-1" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${site.name}" />`,
    `<meta property="og:title" content="${escapeHtml(`${site.name} — ${site.tagline}`)}" />`,
    `<meta property="og:description" content="${escapeHtml(site.summary.slice(0, 200))}" />`,
    `<meta property="og:image" content="/icon-512.png" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<link rel="alternate" type="text/markdown" href="/llms.txt" title="llms.txt" />`,
    `<script type="application/ld+json">${json}</script>`,
  ].join('\n    ');
  // Crawlers and assistants often read HTML without running JavaScript; this is what they (and
  // people without JavaScript) see. It repeats only the public claims above.
  const noscript = `<noscript>
      <main>
        <h1>${site.name}</h1>
        <p>${escapeHtml(site.summary)}</p>
        <h2>Features</h2>
        <ul>${features.map((f) => `<li><strong>${escapeHtml(f.en)}</strong> — ${escapeHtml(f.detail)}</li>`).join('')}</ul>
        <h2>Frequently asked questions</h2>
        ${faq.map((f) => `<h3>${escapeHtml(f.q.en)}</h3><p>${escapeHtml(f.a.en)}</p>`).join('')}
        <p>SDD Studio needs JavaScript to sign in. <a href="/llms.txt">Read the product summary as text</a>.</p>
      </main>
    </noscript>`;
  return { head, noscript };
}
