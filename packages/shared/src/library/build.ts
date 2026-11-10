import type { ModuleDraft, ProjectType } from '../template-types';

const headless: ProjectType[] = ['API / service', 'Library / SDK'];

export const buildModules: ModuleDraft[] = [
  {
    id: 'design',
    title: ['UX & design system', 'UX et système de design'],
    description: [
      'Make the experience coherent and accessible.',
      'Créez une expérience cohérente et accessible.',
    ],
    guidance: [
      'Design from the journeys, not from individual screens. Define reusable components with every interaction state (loading, empty, error, disabled) and express visual decisions as tokens so they stay consistent.',
      'Concevez à partir des parcours, pas d’écrans isolés. Définissez des composants réutilisables avec tous leurs états (chargement, vide, erreur, désactivé) et exprimez les choix visuels en jetons pour garantir la cohérence.',
    ],
    dependsOn: ['workflows'],
    references: [
      { title: 'WCAG 2.2', url: 'https://www.w3.org/TR/WCAG22/' },
      { title: 'WAI-ARIA Authoring Practices Guide', url: 'https://www.w3.org/WAI/ARIA/apg/' },
      { title: 'Design Tokens Community Group', url: 'https://www.designtokens.org/' },
    ],
    diagrams: [
      {
        id: 'navigation-map',
        title: ['Navigation map', 'Carte de navigation'],
        code: 'flowchart TD\n  home[Home] --> list[Request list]\n  list --> detail[Request detail]\n  list --> create[New request]\n  create --> detail\n  home --> settings[Settings]',
      },
      {
        id: 'component-states',
        title: ['Component states', 'États d’un composant'],
        code: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Loading: submit\n  Loading --> Success: 2xx\n  Loading --> Error: failure\n  Error --> Idle: retry\n  Success --> [*]',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        skip: headless,
        label: ['Navigation and information architecture', 'Navigation et architecture de l’information'],
        prompt: [
          'How is the product organized, and how do people move through it?',
          'Comment le produit est-il organisé, et comment s’y déplace-t-on ?',
        ],
        explain: [
          'Information architecture groups content the way users think about it. Describe the main areas, the navigation pattern and how users return to where they were.',
          'L’architecture de l’information regroupe le contenu comme les utilisateurs le conçoivent. Décrivez les zones principales, le modèle de navigation et le retour au point de départ.',
        ],
        hint: [
          'Top-level areas · navigation pattern · deep links · search · breadcrumbs',
          'Zones principales · modèle de navigation · liens profonds · recherche · fil d’Ariane',
        ],
        example: [
          'Left navigation with Requests, Knowledge base and Settings; every request has a shareable URL; breadcrumbs on detail pages.',
          'Navigation latérale avec Demandes, Base de connaissances et Paramètres ; chaque demande a une adresse partageable ; fil d’Ariane sur les pages de détail.',
        ],
      },
      {
        n: 2,
        required: true,
        skip: headless,
        kind: 'table',
        label: ['Screen inventory', 'Inventaire des écrans'],
        prompt: ['Which screens are needed?', 'Quels écrans sont nécessaires ?'],
        explain: [
          'List each screen with its purpose and main action. Link screens to use cases so nothing is designed without a reason.',
          'Listez chaque écran avec son objectif et son action principale. Reliez les écrans aux cas d’utilisation pour que rien ne soit conçu sans raison.',
        ],
        hint: ['Screen · purpose · primary action · use case', 'Écran · objectif · action principale · cas d’utilisation'],
        example: [
          'New request | Capture an issue | Submit | UC-001',
          'Nouvelle demande | Décrire un problème | Soumettre | UC-001',
        ],
        columns: [
          ['Screen', 'Écran'],
          ['Purpose', 'Objectif'],
          ['Primary action', 'Action principale'],
          ['Use case', 'Cas d’utilisation'],
        ],
      },
      {
        n: 3,
        required: true,
        skip: headless,
        label: ['Components and interaction states', 'Composants et états interactifs'],
        prompt: [
          'Which reusable components are needed, and what states must each support?',
          'Quels composants réutilisables faut-il, et quels états chacun doit-il gérer ?',
        ],
        explain: [
          'Designs usually show the happy path. List loading, empty, error, disabled, focus and success states for each component to avoid surprises in development.',
          'Les maquettes montrent souvent le cas idéal. Listez les états chargement, vide, erreur, désactivé, focus et succès de chaque composant pour éviter les surprises.',
        ],
        hint: [
          'Component · variants · states · content rules · library source',
          'Composant · variantes · états · règles de contenu · bibliothèque source',
        ],
        example: [
          'Button: primary/secondary/danger; default, hover, focus-visible, pressed, loading, disabled. Uses shadcn/ui primitives.',
          'Bouton : principal/secondaire/danger ; défaut, survol, focus visible, pressé, chargement, désactivé. Basé sur shadcn/ui.',
        ],
      },
      {
        n: 4,
        skip: headless,
        label: ['Color and typography tokens', 'Couleurs et typographie'],
        prompt: [
          'Which design tokens define color, type and spacing?',
          'Quels jetons de design définissent couleurs, typographie et espacements ?',
        ],
        explain: [
          'Tokens are named design values (for example color.surface or space.2) shared by design and code. They make themes such as dark mode consistent.',
          'Les jetons sont des valeurs de design nommées (par exemple color.surface ou space.2) partagées entre design et code. Ils rendent les thèmes, comme le mode sombre, cohérents.',
        ],
        hint: [
          'Color roles · contrast ratios · type scale · spacing scale · themes',
          'Rôles de couleur · contrastes · échelle typographique · espacements · thèmes',
        ],
        example: [
          'Color roles: surface, text, muted, accent, danger; body 16 px / 1.5; 4 px spacing scale; light and dark themes with 4.5:1 text contrast.',
          'Rôles : surface, texte, atténué, accent, danger ; corps 16 px / 1,5 ; espacements par 4 px ; thèmes clair et sombre avec contraste 4,5:1.',
        ],
      },
      {
        n: 5,
        skip: headless,
        label: ['Responsive behavior', 'Comportement adaptatif'],
        prompt: [
          'How does the interface adapt to screen sizes and input methods?',
          'Comment l’interface s’adapte-t-elle aux tailles d’écran et modes de saisie ?',
        ],
        explain: [
          'Define breakpoints and what changes at each: layout, navigation, density. Consider touch targets and zoom up to 200%.',
          'Définissez les points de rupture et ce qui change à chacun : mise en page, navigation, densité. Pensez aux cibles tactiles et au zoom jusqu’à 200 %.',
        ],
        hint: [
          'Breakpoints · layout changes · touch targets · zoom · orientation',
          'Points de rupture · changements de mise en page · cibles tactiles · zoom · orientation',
        ],
        example: [
          'Below 768 px the side navigation becomes a menu button; tables become cards; touch targets are at least 44 px.',
          'Sous 768 px, la navigation latérale devient un bouton de menu ; les tableaux deviennent des cartes ; cibles tactiles d’au moins 44 px.',
        ],
      },
      {
        n: 6,
        required: true,
        skip: headless,
        label: ['Keyboard and assistive technology', 'Clavier et technologies d’assistance'],
        prompt: [
          'How will keyboard and screen-reader users complete every task?',
          'Comment les utilisateurs du clavier et des lecteurs d’écran accompliront-ils chaque tâche ?',
        ],
        explain: [
          'Every action must be reachable by keyboard in a logical order with a visible focus indicator. Dialogs trap focus and return it when closed.',
          'Chaque action doit être accessible au clavier dans un ordre logique avec un indicateur de focus visible. Les dialogues retiennent le focus et le restituent à la fermeture.',
        ],
        hint: [
          'Focus order · shortcuts · focus visibility · landmarks · live regions · tested AT',
          'Ordre du focus · raccourcis · visibilité du focus · repères · zones dynamiques · technologies testées',
        ],
        example: [
          'Skip link to main content; Ctrl+S saves; status changes announced through a polite live region; tested with NVDA and VoiceOver.',
          'Lien d’évitement vers le contenu ; Ctrl+S enregistre ; changements d’état annoncés dans une zone dynamique ; testé avec NVDA et VoiceOver.',
        ],
      },
      {
        n: 7,
        skip: headless,
        label: ['UX validation plan', 'Plan de validation UX'],
        prompt: [
          'How will you check that the design works for real users?',
          'Comment vérifierez-vous que la conception fonctionne pour de vrais utilisateurs ?',
        ],
        explain: [
          'Plan usability tests, prototypes and success criteria before building. Five participants per round usually reveal the biggest problems.',
          'Planifiez tests d’utilisabilité, prototypes et critères de réussite avant de construire. Cinq participants par série révèlent généralement les principaux problèmes.',
        ],
        hint: ['Method · participants · tasks · success criteria · timing', 'Méthode · participants · tâches · critères · calendrier'],
        example: [
          'Clickable prototype tested with 5 customers; success = 4 of 5 submit a request unaided in under 3 minutes.',
          'Prototype cliquable testé avec 5 clients ; réussite = 4 sur 5 soumettent une demande sans aide en moins de 3 minutes.',
        ],
      },
      {
        n: 8,
        required: true,
        only: headless,
        label: ['Developer experience', 'Expérience développeur'],
        prompt: [
          'How will developers discover, learn and debug this API or library?',
          'Comment les développeurs découvriront-ils, apprendront-ils et débogueront-ils cette API ou bibliothèque ?',
        ],
        explain: [
          'For headless products, developers are the users. Plan reference docs, quick starts, examples, error messages and SDK ergonomics.',
          'Pour un produit sans interface, les développeurs sont les utilisateurs. Prévoyez documentation de référence, démarrages rapides, exemples, messages d’erreur et ergonomie du SDK.',
        ],
        hint: [
          'Quick start · reference docs · examples · error messages · time to first call',
          'Démarrage rapide · référence · exemples · messages d’erreur · temps jusqu’au premier appel',
        ],
        example: [
          'Generated reference from OpenAPI; a 5-minute quick start; every error includes a code and a documentation link; target: first successful call in under 10 minutes.',
          'Référence générée depuis OpenAPI ; démarrage en 5 minutes ; chaque erreur inclut un code et un lien vers la documentation ; cible : premier appel réussi en moins de 10 minutes.',
        ],
      },
    ],
  },
  {
    id: 'technology',
    title: ['Technology & tooling', 'Technologies et outils'],
    description: ['Choose technology with evidence.', 'Choisissez les technologies avec des preuves.'],
    guidance: [
      'Select technologies from the workspace catalog so choices stay consistent across projects. For each selection record the version, license, support lifecycle and the ADR that justifies it.',
      'Choisissez les technologies dans le catalogue de l’espace de travail pour rester cohérent entre projets. Pour chaque choix, consignez la version, la licence, le cycle de support et l’ADR qui le justifie.',
    ],
    dependsOn: ['architecture', 'quality'],
    references: [
      { title: 'Thoughtworks Technology Radar', url: 'https://www.thoughtworks.com/radar' },
      { title: 'SPDX License List', url: 'https://spdx.org/licenses/' },
      { title: 'endoflife.date', url: 'https://endoflife.date/' },
    ],
    diagrams: [
      {
        id: 'selection-rings',
        title: ['Selections by ring', 'Choix par anneau'],
        code: 'flowchart LR\n  subgraph adopt[Adopt]\n    ts[TypeScript]\n    react[React]\n  end\n  subgraph trial[Trial]\n    otel[OpenTelemetry]\n  end\n  subgraph assess[Assess]\n    agents[Coding agents]\n  end\n  subgraph hold[Hold]\n    legacy[Legacy ORM]\n  end',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        kind: 'table',
        label: ['Selected frameworks and platforms', 'Frameworks et plateformes retenus'],
        prompt: [
          'Which applications, frameworks, libraries and platforms will you use?',
          'Quels applications, frameworks, bibliothèques et plateformes utiliserez-vous ?',
        ],
        explain: [
          'List each selection with its version and purpose. Link it to a catalog entry so the radar and license review stay in sync.',
          'Listez chaque choix avec sa version et son rôle. Reliez-le à une entrée du catalogue pour garder le radar et la revue des licences à jour.',
        ],
        hint: [
          'Technology · version · purpose · radar ring · ADR',
          'Technologie · version · rôle · anneau du radar · ADR',
        ],
        example: [
          'React | 19 | Web interface | Adopt | ADR-002',
          'React | 19 | Interface web | Adopter | ADR-002',
        ],
        columns: [
          ['Technology', 'Technologie'],
          ['Version', 'Version'],
          ['Purpose', 'Rôle'],
          ['Ring', 'Anneau'],
        ],
      },
      {
        n: 2,
        required: true,
        label: ['Version and support policies', 'Versions et support'],
        prompt: [
          'Which versions are supported, and how will you stay current?',
          'Quelles versions sont prises en charge, et comment resterez-vous à jour ?',
        ],
        explain: [
          'Every runtime and framework has an end-of-life date. Choose supported versions and define how quickly security updates are applied.',
          'Chaque environnement d’exécution et framework a une date de fin de vie. Choisissez des versions prises en charge et définissez le délai d’application des correctifs de sécurité.',
        ],
        hint: [
          'Pinned versions · LTS/end of life · update cadence · security patch SLA',
          'Versions figées · LTS/fin de vie · rythme de mise à jour · délai de correctif',
        ],
        example: [
          'Node.js 24 LTS (supported to April 2028); dependencies updated monthly; critical security patches within 72 hours.',
          'Node.js 24 LTS (prise en charge jusqu’en avril 2028) ; dépendances mises à jour chaque mois ; correctifs critiques sous 72 heures.',
        ],
      },
      {
        n: 3,
        required: true,
        label: ['Licenses and restrictions', 'Licences et restrictions'],
        prompt: [
          'Which licenses are acceptable, and which are restricted?',
          'Quelles licences sont acceptables, et lesquelles sont restreintes ?',
        ],
        explain: [
          'Licenses determine how you may use and distribute dependencies. Record an allowlist (for example MIT, Apache-2.0) and which licenses need legal review.',
          'Les licences déterminent l’usage et la distribution des dépendances. Consignez une liste autorisée (par exemple MIT, Apache-2.0) et celles qui exigent une revue juridique.',
        ],
        hint: [
          'Allowed SPDX IDs · review-required · forbidden · scanning tool',
          'Identifiants SPDX permis · revue requise · interdits · outil d’analyse',
        ],
        example: [
          'Allowed: MIT, Apache-2.0, BSD-3-Clause, ISC. Review: MPL-2.0, LGPL. Forbidden for distributed code: AGPL. Checked in CI.',
          'Permises : MIT, Apache-2.0, BSD-3-Clause, ISC. Revue : MPL-2.0, LGPL. Interdite pour le code distribué : AGPL. Vérifié dans l’intégration continue.',
        ],
      },
      {
        n: 4,
        kind: 'comparison',
        label: ['Alternatives considered', 'Alternatives envisagées'],
        prompt: [
          'Which alternatives were compared for major technology choices?',
          'Quelles alternatives ont été comparées pour les choix technologiques importants ?',
        ],
        explain: [
          'A short comparison table shows the reasoning behind a choice and makes future re-evaluation easier.',
          'Un court tableau comparatif montre le raisonnement derrière un choix et facilite les réévaluations futures.',
        ],
        hint: ['Option · strengths · weaknesses · decision', 'Option · forces · faiblesses · décision'],
        example: [
          'PostgreSQL | Relational integrity, team experience | Schema migrations for flexible documents | Not chosen',
          'PostgreSQL | Intégrité relationnelle, expérience de l’équipe | Migrations pour documents flexibles | Non retenu',
        ],
      },
      {
        n: 5,
        label: ['Official and custom references', 'Références officielles et personnalisées'],
        prompt: [
          'Which documentation should implementers follow?',
          'Quelle documentation les développeurs doivent-ils suivre ?',
        ],
        explain: [
          'Link official documentation for the versions you chose, plus internal guides. Coding agents use these references to avoid outdated patterns.',
          'Liez la documentation officielle des versions retenues et vos guides internes. Les agents de code s’en servent pour éviter les pratiques obsolètes.',
        ],
        hint: ['Official docs · version-specific links · internal guides', 'Documentation officielle · liens par version · guides internes'],
        example: [
          'React 19 docs (react.dev), Fastify v5 reference, internal “API error conventions” page.',
          'Documentation React 19 (react.dev), référence Fastify v5, page interne « Conventions d’erreurs API ».',
        ],
      },
      {
        n: 6,
        label: ['Development tooling', 'Outils de développement'],
        prompt: [
          'Which tools will the team use to build, test and review?',
          'Quels outils l’équipe utilisera-t-elle pour construire, tester et relire ?',
        ],
        explain: [
          'Standard tooling keeps onboarding quick: package manager, editor settings, formatters, test runners and review tools.',
          'Des outils standards accélèrent l’intégration : gestionnaire de paquets, réglages d’éditeur, formateurs, exécuteurs de tests et outils de revue.',
        ],
        hint: [
          'Package manager · IDE setup · formatter · linter · test runner · AI assistants',
          'Gestionnaire de paquets · IDE · formateur · analyseur · tests · assistants IA',
        ],
        example: [
          'pnpm workspaces, Prettier, ESLint, Vitest, Playwright; Claude Code and Copilot with repository instructions.',
          'Espaces de travail pnpm, Prettier, ESLint, Vitest, Playwright ; Claude Code et Copilot avec instructions du dépôt.',
        ],
      },
      {
        n: 7,
        label: ['Adoption rationale', 'Justification de l’adoption'],
        prompt: [
          'Why are these technologies the right fit for this project?',
          'Pourquoi ces technologies conviennent-elles à ce projet ?',
        ],
        explain: [
          'Explain the fit in terms of requirements, team skills and operations, not popularity. Link to ADRs for detail.',
          'Expliquez l’adéquation en fonction des exigences, des compétences et de l’exploitation, pas de la popularité. Renvoyez aux ADR pour le détail.',
        ],
        hint: ['Requirement fit · team skills · operability · cost · ADR links', 'Adéquation · compétences · exploitation · coût · liens ADR'],
        example: [
          'TypeScript end to end lets the team share validation schemas between UI and API (ADR-003).',
          'TypeScript de bout en bout permet de partager les schémas de validation entre interface et API (ADR-003).',
        ],
      },
      {
        n: 8,
        label: ['Approved usage and restrictions', 'Usages approuvés et restrictions'],
        prompt: [
          'How may each technology be used, and what is not allowed?',
          'Comment chaque technologie peut-elle être utilisée, et qu’est-ce qui est interdit ?',
        ],
        explain: [
          'Approval is often conditional — for example “Assess only in prototypes” or “no customer data in this SaaS tool”. Write the conditions down.',
          'L’approbation est souvent conditionnelle — par exemple « à évaluer seulement en prototype » ou « aucune donnée client dans cet outil SaaS ». Consignez les conditions.',
        ],
        hint: ['Technology · approved scope · restrictions · approver', 'Technologie · portée approuvée · restrictions · approbateur'],
        example: [
          'Hosted AI providers: allowed for specification drafting; forbidden for projects marked local-only. Approved by Security.',
          'Fournisseurs d’IA hébergés : permis pour rédiger des spécifications ; interdits pour les projets « locaux uniquement ». Approuvé par la Sécurité.',
        ],
      },
    ],
  },
  {
    id: 'conventions',
    title: ['Engineering conventions', 'Conventions de développement'],
    description: [
      'Give contributors a shared vocabulary.',
      'Donnez un vocabulaire commun aux contributeurs.',
    ],
    guidance: [
      'Conventions are most useful when they are specific and enforced by tools. Pair every rule with a short do / don’t example — people and coding agents follow examples more reliably than prose.',
      'Les conventions sont utiles lorsqu’elles sont précises et appliquées par des outils. Associez chaque règle à un court exemple « à faire / à éviter » — personnes et agents de code suivent mieux les exemples que la prose.',
    ],
    dependsOn: ['technology', 'architecture'],
    references: [
      { title: 'Conventional Commits', url: 'https://www.conventionalcommits.org/' },
      { title: 'Semantic Versioning', url: 'https://semver.org/' },
      { title: 'EditorConfig', url: 'https://editorconfig.org/' },
    ],
    diagrams: [
      {
        id: 'repository-layout',
        title: ['Repository layout', 'Organisation du dépôt'],
        code: 'flowchart TD\n  root[repository] --> apps[apps]\n  root --> packages[packages]\n  root --> docs[docs]\n  apps --> web[web: user interface]\n  apps --> api[api: HTTP service]\n  packages --> shared[shared: schemas and domain]\n  web -.->|imports| shared\n  api -.->|imports| shared',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        label: ['Naming and nomenclature', 'Nommage et nomenclature'],
        prompt: [
          'How are code elements, files and domain terms named?',
          'Comment nomme-t-on les éléments de code, fichiers et termes métier ?',
        ],
        explain: [
          'Consistent names reduce misunderstandings. Include a glossary of domain terms so code, UI and documentation use the same words.',
          'Des noms cohérents réduisent les malentendus. Incluez un glossaire métier pour que le code, l’interface et la documentation emploient les mêmes mots.',
        ],
        hint: [
          'Casing per element · file names · identifiers (REQ-, ADR-) · glossary',
          'Casse par élément · noms de fichiers · identifiants (REQ-, ADR-) · glossaire',
        ],
        example: [
          'camelCase variables, PascalCase components, kebab-case files. “Request” (not ticket/case) everywhere.',
          'Variables en camelCase, composants en PascalCase, fichiers en kebab-case. « Demande » (pas billet ni dossier) partout.',
        ],
      },
      {
        n: 2,
        required: true,
        label: ['Repository and folder structure', 'Structure du dépôt et des dossiers'],
        prompt: [
          'How is the repository organized?',
          'Comment le dépôt est-il organisé ?',
        ],
        explain: [
          'A predictable layout helps people and agents find code. Describe top-level folders and where new features, tests and documentation go.',
          'Une organisation prévisible aide personnes et agents à trouver le code. Décrivez les dossiers principaux et l’emplacement des nouvelles fonctionnalités, tests et documents.',
        ],
        hint: ['Top-level folders · feature placement · tests location · docs · .plan', 'Dossiers principaux · emplacement des fonctionnalités · tests · documentation · .plan'],
        example: [
          'apps/web, apps/api, packages/shared; tests beside code as *.test.ts; end-to-end tests in tests/e2e; specification in .plan/.',
          'apps/web, apps/api, packages/shared ; tests à côté du code en *.test.ts ; tests de bout en bout dans tests/e2e ; spécification dans .plan/.',
        ],
      },
      {
        n: 3,
        label: ['Backend and frontend boundaries', 'Frontières backend et frontend'],
        prompt: [
          'Which responsibilities belong to the client, the server and shared code?',
          'Quelles responsabilités reviennent au client, au serveur et au code partagé ?',
        ],
        explain: [
          'Clear boundaries keep security and business rules on the server while sharing types and validation where it helps.',
          'Des frontières claires gardent la sécurité et les règles métier côté serveur tout en partageant types et validation lorsque c’est utile.',
        ],
        hint: [
          'Server-only rules · shared schemas · client state · import direction',
          'Règles côté serveur · schémas partagés · état client · sens des dépendances',
        ],
        example: [
          'Authorization and persistence only in apps/api; zod schemas in packages/shared; the web app never imports from apps/api.',
          'Autorisation et persistance uniquement dans apps/api ; schémas zod dans packages/shared ; l’application web n’importe jamais apps/api.',
        ],
      },
      {
        n: 4,
        required: true,
        label: ['Lint and formatting rules', 'Règles de lint et formatage'],
        prompt: [
          'Which lint and formatting rules are enforced, and where?',
          'Quelles règles de lint et de formatage sont appliquées, et où ?',
        ],
        explain: [
          'Automate style so reviews focus on behaviour. State the tools, the shared configuration, and whether CI blocks on violations.',
          'Automatisez le style pour que les revues portent sur le comportement. Indiquez les outils, la configuration partagée et si l’intégration continue bloque les violations.',
        ],
        hint: ['Formatter · linter · config location · pre-commit · CI gate', 'Formateur · analyseur · configuration · pré-commit · barrière CI'],
        example: [
          'Prettier (100 columns, single quotes) and ESLint with typescript-eslint; CI fails on any warning.',
          'Prettier (100 colonnes, apostrophes simples) et ESLint avec typescript-eslint ; l’intégration continue échoue au moindre avertissement.',
        ],
      },
      {
        n: 5,
        label: ['Error handling conventions', 'Conventions de gestion d’erreurs'],
        prompt: [
          'How should code raise, handle and report errors?',
          'Comment le code doit-il lever, traiter et signaler les erreurs ?',
        ],
        explain: [
          'Agree when to throw, when to return results, how to wrap errors with context, and what reaches users versus logs.',
          'Convenez du moment où lever une exception ou renvoyer un résultat, de la façon d’ajouter du contexte, et de ce qui va à l’utilisateur ou aux journaux.',
        ],
        hint: [
          'Error types · user-facing messages · logging level · no secrets · retries',
          'Types d’erreur · messages utilisateur · niveau de journalisation · aucun secret · nouvelles tentatives',
        ],
        example: [
          'Throw HttpError with a status and safe message; unexpected errors log details server-side and return a generic message.',
          'Lever HttpError avec un statut et un message sûr ; les erreurs inattendues sont détaillées dans les journaux serveur et renvoient un message générique.',
        ],
      },
      {
        n: 6,
        label: ['Documentation conventions', 'Conventions documentaires'],
        prompt: [
          'What documentation must accompany changes?',
          'Quelle documentation doit accompagner les changements ?',
        ],
        explain: [
          'Decide what lives in code comments, READMEs, ADRs and the .plan folder, and when each must be updated.',
          'Décidez de ce qui va dans les commentaires, les README, les ADR et le dossier .plan, et quand chacun doit être mis à jour.',
        ],
        hint: [
          'README per module · ADRs · changelog · .plan updates · API docs',
          'README par module · ADR · journal des changements · mises à jour .plan · documentation API',
        ],
        example: [
          'Every pull request updates .plan/tasks.md and changes.md; new architectural choices add an ADR.',
          'Chaque demande de fusion met à jour .plan/tasks.md et changes.md ; tout nouveau choix d’architecture ajoute un ADR.',
        ],
      },
      {
        n: 7,
        required: true,
        kind: 'table',
        label: ['Do and do not examples', 'Exemples à suivre et à éviter'],
        prompt: [
          'Which concrete examples show the conventions in practice?',
          'Quels exemples concrets illustrent les conventions ?',
        ],
        explain: [
          'Short paired examples remove ambiguity. Focus on mistakes that are common or costly in this codebase.',
          'De courts exemples appariés lèvent l’ambiguïté. Concentrez-vous sur les erreurs fréquentes ou coûteuses dans ce code.',
        ],
        hint: ['Do · don’t · why', 'À faire · à éviter · pourquoi'],
        example: [
          'Validate input with the shared schema | Hand-written checks in the route | One source of truth for contracts',
          'Valider avec le schéma partagé | Vérifications écrites à la main dans la route | Une seule source de vérité',
        ],
        columns: [
          ['Do', 'À faire'],
          ['Don’t', 'À éviter'],
          ['Why', 'Pourquoi'],
        ],
      },
    ],
  },
];
