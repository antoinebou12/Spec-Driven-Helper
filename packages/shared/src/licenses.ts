import type { Spec, Technology } from './schema';
import type { Localized } from './templates';

/**
 * License rules. A license expression is classified into a family, and the project's stack is
 * checked against its own license, distribution model and dependency allow-list
 * (governance.8–10). Findings explain themselves; they are guidance, not legal advice.
 */
export const licenseFamilies = [
  'permissive',
  'weak-copyleft',
  'strong-copyleft',
  'network-copyleft',
  'source-available',
  'commercial',
  'standard',
  'unknown',
] as const;
export type LicenseFamily = (typeof licenseFamilies)[number];

export const familyLabels: Record<LicenseFamily, Localized> = {
  permissive: { en: 'Permissive', fr: 'Permissive' },
  'weak-copyleft': { en: 'Weak copyleft', fr: 'Copyleft faible' },
  'strong-copyleft': { en: 'Strong copyleft', fr: 'Copyleft fort' },
  'network-copyleft': { en: 'Network copyleft', fr: 'Copyleft réseau' },
  'source-available': { en: 'Source-available', fr: 'Source disponible' },
  commercial: { en: 'Commercial', fr: 'Commerciale' },
  standard: { en: 'Open standard', fr: 'Norme ouverte' },
  unknown: { en: 'Not recorded', fr: 'Non consignée' },
};

/** Most permissive first; an `OR` expression takes the first family the licensee can choose. */
const order: LicenseFamily[] = [
  'standard',
  'permissive',
  'weak-copyleft',
  'commercial',
  'strong-copyleft',
  'network-copyleft',
  'source-available',
  'unknown',
];

const single = (raw: string): LicenseFamily => {
  let id = raw.trim().toUpperCase();
  if (id.startsWith('(')) id = id.slice(1);
  if (id.endsWith(')') && !id.includes('(')) id = id.slice(0, -1);
  if (!id) return 'unknown';
  // The LLVM exception relaxes Apache-2.0; the others relax the GPL.
  if (/LLVM-EXCEPTION/.test(id)) return 'permissive';
  if (/CLASSPATH-EXCEPTION|LINKING-EXCEPTION|GCC-EXCEPTION/.test(id)) return 'weak-copyleft';
  if (/^CC-BY(-\d|$)/.test(id)) return 'permissive';
  if (/^CC-BY-SA/.test(id)) return 'weak-copyleft';
  if (/^CC-BY-NC/.test(id)) return 'source-available';
  if (/^(AGPL|SSPL)|AFFERO/.test(id))
    return /^SSPL/.test(id) ? 'source-available' : 'network-copyleft';
  if (/^(BUSL|BSL-1\.1|ELASTIC|CONFLUENT|COMMONS-CLAUSE|FSL|POLYFORM)/.test(id))
    return 'source-available';
  if (/^(LGPL|MPL|EPL|CDDL|EUPL|OSL|CPL|MS-RL|OFL)/.test(id)) return 'weak-copyleft';
  if (/^GPL|\(GPL\)/.test(id)) return 'strong-copyleft';
  if (
    /^(MIT|ISC|BSD|APACHE|ZLIB|UNLICENSE|0BSD|CC0|PSF|PYTHON|BSL-1\.0|BOOST|MS-PL|POSTGRESQL|X11|NCSA|W3C-SOFTWARE|UPL|BLUEOAK|PUBLIC DOMAIN)/.test(
      id,
    )
  )
    return 'permissive';
  if (/COMMERCIAL|PROPRIETARY/.test(id)) return 'commercial';
  if (/STANDARD|SPECIFICATION|RFC|OASIS|W3C|ISO/.test(id)) return 'standard';
  return 'unknown';
};

/** Classifies an SPDX-like expression. `A OR B` and `A / B` offer a choice; `A AND B` applies both. */
export function licenseFamily(expression: string | undefined): LicenseFamily {
  const text = (expression ?? '').trim();
  if (!text) return 'unknown';
  const worst = (fams: LicenseFamily[]) =>
    fams.reduce((a, b) => (order.indexOf(b) > order.indexOf(a) ? b : a));
  const best = (fams: LicenseFamily[]) =>
    fams.reduce((a, b) => (order.indexOf(b) < order.indexOf(a) ? b : a));
  const choices = text.split(/\s+OR\s+|\s*\/\s*/i);
  return best(choices.map((choice) => worst(choice.split(/\s+AND\s+/i).map(single))));
}

export type LicensePolicy = {
  projectLicense: string;
  distribution: string;
  allowed: LicenseFamily[];
};

const allowedByOption: [RegExp, LicenseFamily[]][] = [
  [/^Permissive/, ['permissive', 'standard']],
  [/^Weak copyleft/, ['weak-copyleft']],
  [/^Strong copyleft/, ['strong-copyleft']],
  [/^Network copyleft/, ['network-copyleft']],
  [/^Source-available/, ['source-available']],
  [/^Commercial/, ['commercial']],
];

/** Reads the policy from the governance answers. */
export function licensePolicy(spec: Pick<Spec, 'sections'>): LicensePolicy {
  const answers = spec.sections.find((s) => s.id === 'governance')?.answers ?? {};
  const value = (id: string) => answers[id]?.value?.trim() ?? '';
  let chosen: string[] = [];
  try {
    const parsed = JSON.parse(value('governance.10') || '[]');
    if (Array.isArray(parsed)) chosen = parsed.map(String);
  } catch {
    chosen = [];
  }
  return {
    projectLicense: value('governance.8'),
    distribution: value('governance.9'),
    allowed: [
      ...new Set(chosen.flatMap((c) => allowedByOption.find(([re]) => re.test(c))?.[1] ?? [])),
    ],
  };
}

export type LicenseFinding = {
  technologyId: string;
  technology: string;
  license: string;
  family: LicenseFamily;
  severity: 'blocker' | 'warning' | 'info';
  rule:
    | 'copyleft-distribution'
    | 'network-copyleft'
    | 'source-available'
    | 'not-allowed'
    | 'weak-copyleft'
    | 'commercial'
    | 'unknown';
  message: Localized;
};

/** Code that ends up linked into, or shipped with, the product. */
const shipped = new Set<Technology['category']>(['framework', 'library', 'runtime']);
/** Separate processes the product talks to over the network. */
const services = new Set<Technology['category']>([
  'database',
  'messaging',
  'platform',
  'observability',
  'ai',
]);

const distributes = (d: string) => /Distributed|Published|Embedded/i.test(d);
const saas = (d: string) => /SaaS|Hosted/i.test(d);
const openProject = (license: string) => /^(GPL|AGPL|LGPL|MPL)/i.test(license);

export function licenseFindings(
  stack: Pick<Technology, 'id' | 'name' | 'license' | 'category'>[],
  policy: LicensePolicy,
): LicenseFinding[] {
  const out: LicenseFinding[] = [];
  for (const t of stack) {
    const family = licenseFamily(t.license);
    const base = { technologyId: t.id, technology: t.name, license: t.license, family };
    const add = (
      severity: LicenseFinding['severity'],
      rule: LicenseFinding['rule'],
      en: string,
      fr: string,
    ) => out.push({ ...base, severity, rule, message: { en, fr } });
    const linked = shipped.has(t.category);
    const service = services.has(t.category);
    if (family === 'unknown') {
      add(
        'info',
        'unknown',
        `${t.name} has no recorded license. Record it in the technology catalog.`,
        `${t.name} n’a pas de licence consignée. Consignez-la dans le catalogue.`,
      );
      continue;
    }
    if (
      family === 'strong-copyleft' &&
      linked &&
      distributes(policy.distribution) &&
      !openProject(policy.projectLicense)
    )
      add(
        'blocker',
        'copyleft-distribution',
        `${t.name} (${t.license}) is linked into a product distributed under a non-GPL license. Distributing it requires releasing the combined source under the GPL.`,
        `${t.name} (${t.license}) est lié à un produit distribué sous une licence non GPL. Le distribuer exige de publier le code combiné sous GPL.`,
      );
    else if (
      family === 'network-copyleft' &&
      linked &&
      (saas(policy.distribution) || distributes(policy.distribution)) &&
      !/^AGPL/i.test(policy.projectLicense)
    )
      add(
        'blocker',
        'network-copyleft',
        `${t.name} (${t.license}) is part of the product: users of the service must be offered its complete source code.`,
        `${t.name} (${t.license}) fait partie du produit : les utilisateurs du service doivent recevoir tout son code source.`,
      );
    else if (family === 'network-copyleft' && service && saas(policy.distribution))
      add(
        'warning',
        'network-copyleft',
        `${t.name} (${t.license}) runs as a separate service. Using it unmodified is usually fine; any modification offered over the network must be published.`,
        `${t.name} (${t.license}) s’exécute comme service distinct. L’utiliser sans modification convient généralement ; toute modification offerte en réseau doit être publiée.`,
      );
    if (family === 'source-available')
      add(
        saas(policy.distribution) || distributes(policy.distribution) ? 'warning' : 'info',
        'source-available',
        `${t.name} (${t.license}) is source-available, not open source. Check its usage restrictions, such as offering a competing hosted service.`,
        `${t.name} (${t.license}) est à source disponible, pas libre. Vérifiez ses restrictions d’usage, comme offrir un service hébergé concurrent.`,
      );
    if (family === 'weak-copyleft' && linked && distributes(policy.distribution))
      add(
        'info',
        'weak-copyleft',
        `${t.name} (${t.license}): publish any changes you make to it, and keep it as a separate, replaceable library.`,
        `${t.name} (${t.license}) : publiez vos modifications et gardez-la comme bibliothèque distincte et remplaçable.`,
      );
    if (family === 'commercial')
      add(
        'info',
        'commercial',
        `${t.name} is commercial. Confirm the agreement covers your usage, users and regions.`,
        `${t.name} est commercial. Confirmez que l’entente couvre votre usage, vos utilisateurs et vos régions.`,
      );
    if (
      policy.allowed.length &&
      family !== 'standard' &&
      !policy.allowed.includes(family) &&
      (linked || service)
    )
      add(
        'warning',
        'not-allowed',
        `${t.name} uses a ${familyLabels[family].en.toLowerCase()} license (${t.license}), which is not in the project’s allowed list. Record an exception or choose an alternative.`,
        `${t.name} utilise une licence ${familyLabels[family].fr.toLowerCase()} (${t.license}) absente de la liste permise. Consignez une exception ou choisissez une solution de rechange.`,
      );
  }
  const rank = { blocker: 0, warning: 1, info: 2 };
  return out.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || a.technology.localeCompare(b.technology),
  );
}

/** Classifies a LICENSE file by its text. */
export function licenseFromText(text: string): string | undefined {
  const t = text.slice(0, 4000);
  if (/GNU AFFERO GENERAL PUBLIC LICENSE/i.test(t)) return 'AGPL-3.0';
  if (/GNU LESSER GENERAL PUBLIC LICENSE/i.test(t))
    return /Version 2\.1/i.test(t) ? 'LGPL-2.1' : 'LGPL-3.0';
  if (/GNU GENERAL PUBLIC LICENSE/i.test(t)) return /Version 2/i.test(t) ? 'GPL-2.0' : 'GPL-3.0';
  if (/Mozilla Public License,? Version 2\.0/i.test(t)) return 'MPL-2.0';
  if (/Business Source License/i.test(t)) return 'BUSL-1.1';
  if (/Server Side Public License/i.test(t)) return 'SSPL-1.0';
  if (/Apache License,?\s+Version 2\.0/i.test(t)) return 'Apache-2.0';
  if (/Eclipse Public License/i.test(t)) return 'EPL-2.0';
  if (/Permission is hereby granted, free of charge/i.test(t)) return 'MIT';
  if (/Redistribution and use in source and binary forms/i.test(t))
    return /Neither the name/i.test(t) ? 'BSD-3-Clause' : 'BSD-2-Clause';
  if (/Permission to use, copy, modify, and\/or distribute this software/i.test(t)) return 'ISC';
  if (/This is free and unencumbered software released into the public domain/i.test(t))
    return 'Unlicense';
  return undefined;
}

/** governance.8 option for a detected project license. */
const projectOptions: [RegExp, string][] = [
  [/^MIT$/i, 'MIT'],
  [/^Apache-2\.0$/i, 'Apache-2.0'],
  [/^BSD-3-Clause$/i, 'BSD-3-Clause'],
  [/^MPL-2\.0$/i, 'MPL-2.0'],
  [/^LGPL-3\.0/i, 'LGPL-3.0'],
  [/^GPL-3\.0/i, 'GPL-3.0'],
  [/^AGPL-3\.0/i, 'AGPL-3.0'],
  [/^(UNLICENSED|PROPRIETARY)$/i, 'Proprietary (all rights reserved)'],
];
export function projectLicenseOption(spdx: string): string {
  const match = projectOptions.find(([re]) => re.test(spdx.trim()))?.[1];
  if (match) return match;
  return licenseFamily(spdx) === 'source-available' ? 'Source-available (BUSL, Elastic, …)' : spdx;
}
