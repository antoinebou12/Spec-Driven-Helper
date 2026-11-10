import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Spec } from '../../../packages/shared/src/schema';
import { modules } from '../../../packages/shared/src/templates';
import { stripAnswerMarkers } from '../../../packages/shared/src/markdown';
const require = createRequire(import.meta.url);
export function reportHTML(spec: Spec) {
  const l = (en: string, fr: string) => (spec.language === 'fr' ? fr : en);
  return (
    '<!doctype html>' +
    renderToStaticMarkup(
      <html lang={spec.language}>
        <head>
          <meta charSet="utf-8" />
          <title>{spec.name}</title>
          <style>{`body{font:11pt/1.65 Arial,sans-serif;color:#26364c}h1,h2,h3{color:#142b4e;break-after:avoid}h1{font-size:30pt}h2{font-size:20pt}h3{font-size:14pt}.cover{height:850px;display:flex;flex-direction:column;justify-content:center}.eyebrow{color:#356be5;letter-spacing:3px;font-size:10pt}.meta{color:#70829b;margin-top:40px}.contents{break-after:page}.chapter{break-before:page}a{color:#3068bc}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f6fb;padding:14px;font-size:9pt}table{border-collapse:collapse;width:100%;font-size:9pt}td,th{border:1px solid #dbe3ef;padding:7px}blockquote{border-left:3px solid #8dafe8;padding-left:15px;color:#657a99}img,svg{max-width:100%;max-height:650px}li{margin-bottom:5px}.references{font-size:9pt;border-top:1px solid #ccd6e6;margin-top:25px;padding-top:15px}.diagram{break-inside:avoid}.diagram-error{color:#9a3d43}p{orphans:3;widows:3}`}</style>
        </head>
        <body>
          <section className="cover">
            <p className="eyebrow">{l('SDD STUDIO / PROJECT SPECIFICATION', 'SDD STUDIO / SPÉCIFICATION DU PROJET')}</p>
            <h1>{spec.name}</h1>
            <p>{spec.description}</p>
            <div className="meta">
              {l('Revision', 'Révision')} {spec.revision}
              <br />
              {new Date(spec.updatedAt).toISOString().slice(0, 10)}
              <br />
              {l('Working specification · Review status is recorded in each section.', 'Spécification de travail · Le statut de revue figure dans chaque section.')}
            </div>
          </section>
          <section className="contents">
            <h2>{spec.language === 'fr' ? 'Sommaire' : 'Contents'}</h2>
            <ol>
              {spec.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>
                    {modules.find((m) => m.id === s.id)!.title[spec.language]}
                  </a>
                </li>
              ))}
            </ol>
          </section>
          {spec.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="chapter">
              <p className="eyebrow">
                {String(i + 1).padStart(2, '0')} / {s.status}
              </p>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: () => null }}>
                {stripAnswerMarkers(s.markdown)}
              </ReactMarkdown>
              {s.diagram && <div className="diagram" data-diagram={s.id} />}
              {s.references.length > 0 && (
                <div className="references">
                  <strong>{l('References', 'Références')}</strong>
                  <ul>
                    {s.references.map((r) => (
                      <li key={r.id}>
                        <a href={r.url}>{r.title}</a> — {r.url}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
          <section className="chapter">
            <h2>{l('Appendix: traceability', 'Annexe : traçabilité')}</h2>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>{l('Title', 'Titre')}</th>
                  <th>{l('Status', 'Statut')}</th>
                </tr>
              </thead>
              <tbody>
                {spec.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.id}</td>
                    <td>{i.type}</td>
                    <td>{i.title}</td>
                    <td>{i.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>{l('Relationships', 'Relations')}</h3>
            <ul>
              {spec.links.map((l) => (
                <li key={l.id}>
                  {l.from} → {l.kind} → {l.to}
                </li>
              ))}
            </ul>
          </section>
        </body>
      </html>,
    )
  );
}
export async function renderPDF(spec: Spec) {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.CHROME_CHANNEL || undefined,
    executablePath: process.env.CHROME_EXECUTABLE || undefined,
  });
  try {
    const context = await browser.newContext();
    await context.route('**/*', (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(reportHTML(spec), { waitUntil: 'domcontentloaded' });
    const mermaidPath = join(
      dirname(require.resolve('mermaid/package.json')),
      'dist',
      'mermaid.min.js',
    );
    await page.addScriptTag({ path: mermaidPath });
    await page.evaluate(async ({ sections, message }) => {
      const mermaid = (window as any).mermaid;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
      for (const s of sections) {
        if (!s.diagram) continue;
        const target = document.querySelector(`[data-diagram="${s.id}"]`);
        try {
          const result = await mermaid.render(`report-${s.id}`, s.diagram);
          if (target) target.innerHTML = result.svg;
        } catch {
          if (target)
            target.textContent = message;
        }
      }
    }, { sections: spec.sections, message: spec.language === 'fr' ? 'Le diagramme n’a pas pu être rendu. Vérifiez la source Mermaid.' : 'Diagram could not be rendered. Review the Mermaid source.' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '22mm', left: '20mm', right: '20mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        `<div style="font-size:9px;color:#7a889c;width:100%;padding:0 60px;display:flex;justify-content:space-between"><span>SDD Studio · ${spec.language === 'fr' ? 'Spécification du projet' : 'Project specification'}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
  } finally {
    await browser.close();
  }
}
