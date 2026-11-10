import type { ModuleDraft } from '../template-types';

export const systemModules: ModuleDraft[] = [
  {
    id: 'architecture',
    title: ['Architecture & ADRs', 'Architecture et ADR'],
    description: [
      'Make the reasoning behind decisions visible.',
      'Rendez les raisons des décisions visibles.',
    ],
    guidance: [
      'Start from the system context, then zoom into containers and components. Record every significant, hard-to-reverse choice as an ADR with the alternatives you rejected and why.',
      'Partez du contexte du système, puis détaillez conteneurs et composants. Consignez chaque choix important et difficile à inverser dans un ADR, avec les alternatives écartées et leurs raisons.',
    ],
    dependsOn: ['scope', 'workflows'],
    references: [
      { title: 'C4 model', url: 'https://c4model.com/' },
      { title: 'arc42 architecture template', url: 'https://arc42.org/' },
      { title: 'Architecture Decision Records', url: 'https://adr.github.io/' },
    ],
    diagrams: [
      {
        id: 'system-context',
        title: ['System context', 'Contexte du système'],
        code: 'flowchart LR\n  user([Customer]) -->|uses| system[Customer portal]\n  agent([Support agent]) -->|manages requests| system\n  system -->|authenticates via| idp[(Identity provider)]\n  system -->|sends email via| mail[Email service]',
      },
      {
        id: 'c4-context',
        title: ['C4 context', 'Contexte C4'],
        code: 'C4Context\n  title System context\n  Person(customer, "Customer", "Submits and tracks requests")\n  System(portal, "Customer portal", "Web application")\n  System_Ext(idp, "Identity provider", "OIDC")\n  Rel(customer, portal, "Uses")\n  Rel(portal, idp, "Authenticates with")',
      },
      {
        id: 'deployment',
        title: ['Deployment topology', 'Topologie de déploiement'],
        code: 'flowchart TB\n  subgraph prod[Production]\n    proxy[TLS reverse proxy] --> app[Web and API containers]\n    app --> db[(Database replica set)]\n    worker[Background worker] --> db\n  end\n  users([Users]) --> proxy',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        label: ['System boundaries', 'Frontières du système'],
        prompt: [
          'What is inside the system, and what is external?',
          'Qu’est-ce qui fait partie du système, et qu’est-ce qui est externe ?',
        ],
        explain: [
          'The boundary separates what you build and operate from what you depend on. A system context diagram is the clearest way to show it.',
          'La frontière sépare ce que vous construisez et exploitez de ce dont vous dépendez. Un diagramme de contexte est la façon la plus claire de la montrer.',
        ],
        hint: [
          'Users · owned containers · external systems · data flows crossing the boundary',
          'Utilisateurs · conteneurs gérés · systèmes externes · flux traversant la frontière',
        ],
        example: [
          'Inside: web app, API, worker, database. External: company identity provider, email delivery service.',
          'Interne : application web, API, traitement asynchrone, base de données. Externe : fournisseur d’identité, service de courriel.',
        ],
      },
      {
        n: 2,
        required: true,
        kind: 'table',
        label: ['Components and responsibilities', 'Composants et responsabilités'],
        prompt: [
          'Which components make up the system, and what does each own?',
          'Quels composants forment le système, et de quoi chacun est-il responsable ?',
        ],
        explain: [
          'Each component should have one clear responsibility and a well-defined interface. Give components IDs (CMP-001) so requirements can link to them.',
          'Chaque composant a une responsabilité claire et une interface bien définie. Donnez-leur des identifiants (CMP-001) pour les relier aux exigences.',
        ],
        hint: [
          'ID · responsibility · interface · data owned · technology',
          'ID · responsabilité · interface · données gérées · technologie',
        ],
        example: [
          'CMP-001 | Request API | Validates and stores requests; enforces organization boundaries | Node.js service',
          'CMP-001 | API des demandes | Valide et enregistre les demandes ; applique les frontières d’organisation | Service Node.js',
        ],
        columns: [
          ['Component', 'Composant'],
          ['Responsibility', 'Responsabilité'],
          ['Technology', 'Technologie'],
        ],
      },
      {
        n: 3,
        required: true,
        label: ['Integration contracts', 'Contrats d’intégration'],
        prompt: [
          'How does the system integrate with other systems?',
          'Comment le système s’intègre-t-il aux autres systèmes ?',
        ],
        explain: [
          'For each integration, describe the protocol, the contract owner, authentication, and what happens when the other side is slow or down.',
          'Pour chaque intégration, décrivez le protocole, le responsable du contrat, l’authentification et le comportement si l’autre partie est lente ou indisponible.',
        ],
        hint: [
          'Counterpart · protocol · contract/version · auth · timeout/retry · failure behaviour',
          'Partenaire · protocole · contrat/version · authentification · délai/nouvel essai · comportement en panne',
        ],
        example: [
          'Email service: HTTPS JSON API v3, API key in the secret store, 5 s timeout, 3 retries with backoff, failures queued for 24 h.',
          'Service de courriel : API HTTPS JSON v3, clé dans le coffre de secrets, délai de 5 s, 3 essais avec attente progressive, échecs conservés 24 h.',
        ],
      },
      {
        n: 4,
        required: true,
        label: ['Deployment topology', 'Topologie de déploiement'],
        prompt: [
          'Where and how will the system run?',
          'Où et comment le système fonctionnera-t-il ?',
        ],
        explain: [
          'Describe environments, hosting, network zones, scaling units and data locations. This drives security, cost and operations decisions.',
          'Décrivez les environnements, l’hébergement, les zones réseau, les unités de mise à l’échelle et l’emplacement des données. Cela oriente la sécurité, les coûts et l’exploitation.',
        ],
        hint: [
          'Hosting · regions · network zones · containers/VMs · data residency · scaling unit',
          'Hébergement · régions · zones réseau · conteneurs/VM · résidence des données · unité d’échelle',
        ],
        example: [
          'Two API containers and one worker behind a TLS proxy in the Canada Central region; managed MongoDB replica set in the same region.',
          'Deux conteneurs d’API et un traitement asynchrone derrière un mandataire TLS, région Canada Central ; réplique MongoDB gérée dans la même région.',
        ],
      },
      {
        n: 5,
        kind: 'comparison',
        label: ['Alternatives and tradeoffs', 'Alternatives et compromis'],
        prompt: [
          'Which alternatives did you consider, and why did you choose this approach?',
          'Quelles alternatives avez-vous étudiées, et pourquoi ce choix ?',
        ],
        explain: [
          'Comparing options shows reviewers that a decision was deliberate. Include the option you rejected and the conditions that would change your mind.',
          'Comparer les options montre que la décision est réfléchie. Incluez l’option rejetée et les conditions qui vous feraient changer d’avis.',
        ],
        hint: [
          'Options · criteria · strengths · weaknesses · decision · revisit trigger',
          'Options · critères · forces · faiblesses · décision · condition de réexamen',
        ],
        example: [
          'Modular monolith | Simple deploys, one codebase | Scaling is coarse | Chosen for release 1',
          'Monolithe modulaire | Déploiement simple, un seul code | Mise à l’échelle grossière | Retenu pour la version 1',
        ],
      },
      {
        n: 6,
        required: true,
        label: ['Architecture decisions and rationale', 'Décisions et justifications'],
        prompt: [
          'Which significant architecture decisions have been made?',
          'Quelles décisions d’architecture importantes ont été prises ?',
        ],
        explain: [
          'Architecture Decision Records (ADRs) capture context, decision and consequences. Add each ADR as a traceable decision item so it can be reviewed and accepted.',
          'Les ADR consignent le contexte, la décision et ses conséquences. Ajoutez chaque ADR comme élément de décision traçable pour qu’il soit revu et accepté.',
        ],
        hint: [
          'ADR ID · context · decision · consequences · status · linked requirements',
          'ID d’ADR · contexte · décision · conséquences · statut · exigences liées',
        ],
        example: [
          'ADR-001: Use a modular monolith for release 1 because the team is small; revisit if two modules need independent scaling.',
          'ADR-001 : Monolithe modulaire pour la version 1, car l’équipe est petite ; à revoir si deux modules doivent évoluer indépendamment.',
        ],
      },
      {
        n: 7,
        label: ['Component ownership', 'Responsables des composants'],
        prompt: [
          'Which team owns each component in production?',
          'Quelle équipe est responsable de chaque composant en production ?',
        ],
        explain: [
          'Ownership means someone maintains, upgrades and answers alerts for the component. Unowned components decay.',
          'Être responsable signifie maintenir, mettre à jour et répondre aux alertes du composant. Un composant sans responsable se dégrade.',
        ],
        hint: ['Component · owning team · escalation contact', 'Composant · équipe responsable · contact d’escalade'],
        example: [
          'Request API and worker: Platform Engineering. Email templates: Customer Experience.',
          'API des demandes et traitement asynchrone : Ingénierie plateforme. Modèles de courriel : Expérience client.',
        ],
      },
      {
        n: 8,
        required: true,
        only: ['Mobile application', 'Desktop application', 'Embedded / IoT'],
        label: ['Offline and synchronization strategy', 'Stratégie hors ligne et synchronisation'],
        prompt: [
          'How does the application behave offline, and how does it synchronize?',
          'Comment l’application se comporte-t-elle hors ligne, et comment se synchronise-t-elle ?',
        ],
        explain: [
          'Devices lose connectivity. Decide what works offline, where data is cached, and how conflicting changes are resolved when the device reconnects.',
          'Les appareils perdent la connexion. Décidez ce qui fonctionne hors ligne, où les données sont mises en cache et comment résoudre les conflits à la reconnexion.',
        ],
        hint: [
          'Offline capabilities · local storage · sync trigger · conflict policy · data limits',
          'Fonctions hors ligne · stockage local · déclencheur · politique de conflit · limites',
        ],
        example: [
          'Drafts are stored locally and synced on reconnect; server wins for status fields, the user chooses for text conflicts.',
          'Les brouillons sont stockés localement et synchronisés à la reconnexion ; le serveur prévaut pour les statuts, l’utilisateur tranche pour les textes.',
        ],
      },
    ],
  },
  {
    id: 'data',
    title: ['Data & APIs', 'Données et API'],
    description: [
      'Describe the information the system depends on.',
      'Décrivez les informations nécessaires au système.',
    ],
    guidance: [
      'Model the data before the screens. Define ownership, validation and lifecycle for each entity, and treat every API and event as a versioned contract.',
      'Modélisez les données avant les écrans. Définissez responsable, validation et cycle de vie de chaque entité, et traitez chaque API et événement comme un contrat versionné.',
    ],
    dependsOn: ['architecture', 'workflows'],
    references: [
      { title: 'OpenAPI Specification', url: 'https://spec.openapis.org/oas/latest.html' },
      {
        title: 'AsyncAPI Specification',
        url: 'https://www.asyncapi.com/docs/reference/specification/latest',
      },
      { title: 'JSON Schema', url: 'https://json-schema.org/specification' },
      { title: 'RFC 9457 — Problem Details for HTTP APIs', url: 'https://www.rfc-editor.org/rfc/rfc9457' },
    ],
    diagrams: [
      {
        id: 'entities',
        title: ['Entity relationships', 'Relations entre entités'],
        code: 'erDiagram\n  ORGANIZATION ||--o{ CUSTOMER : employs\n  CUSTOMER ||--o{ REQUEST : submits\n  REQUEST ||--o{ ATTACHMENT : includes\n  REQUEST {\n    string id\n    string status\n    datetime createdAt\n  }',
      },
      {
        id: 'event-flow',
        title: ['Event delivery', 'Livraison des événements'],
        code: 'sequenceDiagram\n  participant API\n  participant Queue as Job queue\n  participant Worker\n  API->>Queue: RequestSubmitted (at least once)\n  Worker->>Queue: Lease job\n  Worker-->>Queue: Acknowledge after notification',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        label: ['Entities and relationships', 'Entités et relations'],
        prompt: [
          'What are the main entities, and how do they relate?',
          'Quelles sont les principales entités, et comment sont-elles liées ?',
        ],
        explain: [
          'Entities are the things your system remembers. Describe their key attributes, identifiers and relationships; an ER diagram helps.',
          'Les entités sont ce que le système mémorise. Décrivez leurs attributs clés, identifiants et relations ; un diagramme entité-relation aide.',
        ],
        hint: [
          'Entity · identifier · key attributes · cardinality · owner · sensitivity',
          'Entité · identifiant · attributs clés · cardinalité · responsable · sensibilité',
        ],
        example: [
          'Organization 1–n Customer; Customer 1–n Request; Request 1–n Attachment. Request IDs are opaque UUIDs.',
          'Organisation 1–n Client ; Client 1–n Demande ; Demande 1–n Pièce jointe. Les ID de demande sont des UUID opaques.',
        ],
      },
      {
        n: 2,
        required: true,
        label: ['API contracts and versioning', 'Contrats API et versions'],
        prompt: [
          'Which APIs does the system expose or consume, and how are they versioned?',
          'Quelles API le système expose-t-il ou consomme-t-il, et comment sont-elles versionnées ?',
        ],
        explain: [
          'An API contract is a promise to its consumers. Describe it in a machine-readable format (for example OpenAPI) and decide how breaking changes are introduced.',
          'Un contrat d’API est une promesse envers ses consommateurs. Décrivez-le dans un format lisible par machine (par exemple OpenAPI) et décidez comment introduire les changements incompatibles.',
        ],
        hint: [
          'Endpoints · format · auth · version scheme · deprecation window · consumers',
          'Points d’accès · format · authentification · versions · délai de dépréciation · consommateurs',
        ],
        example: [
          'REST JSON under /api/v1 documented with OpenAPI 3.1; breaking changes ship as /v2 with 6 months of overlap.',
          'API REST JSON sous /api/v1 documentée en OpenAPI 3.1 ; les changements incompatibles passent en /v2 avec 6 mois de chevauchement.',
        ],
      },
      {
        n: 3,
        label: ['Events and delivery guarantees', 'Événements et garanties de livraison'],
        prompt: [
          'Which events are published, and what delivery guarantees apply?',
          'Quels événements sont publiés, et quelles garanties de livraison s’appliquent ?',
        ],
        explain: [
          'Asynchronous events decouple components but need clear semantics: at-most-once, at-least-once, ordering and idempotency.',
          'Les événements asynchrones découplent les composants mais exigent une sémantique claire : au plus une fois, au moins une fois, ordre et idempotence.',
        ],
        hint: [
          'Event name · payload schema · producer · consumers · guarantee · idempotency key',
          'Nom · schéma · producteur · consommateurs · garantie · clé d’idempotence',
        ],
        example: [
          'RequestSubmitted is delivered at least once; consumers deduplicate by requestId.',
          'RequestSubmitted est livré au moins une fois ; les consommateurs dédupliquent par requestId.',
        ],
      },
      {
        n: 4,
        required: true,
        label: ['Validation and error contracts', 'Validation et contrats d’erreur'],
        prompt: [
          'How is input validated, and how are errors reported?',
          'Comment les entrées sont-elles validées, et comment les erreurs sont-elles signalées ?',
        ],
        explain: [
          'Validate at every trust boundary using shared schemas. A consistent error format lets clients show useful messages.',
          'Validez à chaque frontière de confiance avec des schémas partagés. Un format d’erreur uniforme permet aux clients d’afficher des messages utiles.',
        ],
        hint: [
          'Validation location · schema source · error format · field-level details · codes',
          'Lieu de validation · source du schéma · format d’erreur · détails par champ · codes',
        ],
        example: [
          'Server validates every request with shared JSON Schemas; errors use RFC 9457 problem details with field paths.',
          'Le serveur valide chaque requête avec des schémas JSON partagés ; les erreurs suivent la RFC 9457 avec le chemin des champs.',
        ],
      },
      {
        n: 5,
        required: true,
        label: ['Retention and deletion', 'Conservation et suppression'],
        prompt: [
          'How long is data kept, and how is it deleted?',
          'Combien de temps les données sont-elles conservées, et comment sont-elles supprimées ?',
        ],
        explain: [
          'Retention rules come from legal, contractual and business needs. Decide what is deleted, anonymized or archived, and include backups.',
          'Les règles de conservation découlent d’obligations légales, contractuelles et métier. Décidez de ce qui est supprimé, anonymisé ou archivé, sauvegardes comprises.',
        ],
        hint: [
          'Data type · retention period · deletion method · backups · legal hold',
          'Type de données · durée · méthode de suppression · sauvegardes · conservation légale',
        ],
        example: [
          'Closed requests kept 3 years, then anonymized; attachments deleted after 1 year; backups expire after 35 days.',
          'Demandes fermées conservées 3 ans puis anonymisées ; pièces jointes supprimées après 1 an ; sauvegardes expirées après 35 jours.',
        ],
      },
      {
        n: 6,
        label: ['Schema migrations', 'Migrations de schéma'],
        prompt: [
          'How will data structures change safely over time?',
          'Comment les structures de données évolueront-elles en toute sécurité ?',
        ],
        explain: [
          'Migrations must be repeatable, reviewed and reversible or forward-fixable. Plan how old and new versions coexist during deployment.',
          'Les migrations doivent être reproductibles, revues et réversibles ou corrigeables. Prévoyez la coexistence des anciennes et nouvelles versions pendant le déploiement.',
        ],
        hint: [
          'Tooling · expand/contract steps · backfill · rollback · verification',
          'Outils · étapes d’ajout/retrait · rétro-remplissage · retour arrière · vérification',
        ],
        example: [
          'Versioned migration scripts run before deployment; fields are added first, code switches, old fields removed one release later.',
          'Des scripts versionnés s’exécutent avant le déploiement ; on ajoute d’abord les champs, on bascule le code, puis on retire les anciens une version plus tard.',
        ],
      },
      {
        n: 7,
        label: ['Interoperability and import/export', 'Interopérabilité et import/export'],
        prompt: [
          'How does data move in and out of the system?',
          'Comment les données entrent-elles et sortent-elles du système ?',
        ],
        explain: [
          'Describe supported formats, bulk import and export, and whether round trips are lossless. Imported data is untrusted and must be validated.',
          'Décrivez les formats pris en charge, l’import et l’export en masse, et si les allers-retours sont sans perte. Les données importées ne sont pas fiables et doivent être validées.',
        ],
        hint: [
          'Formats · direction · lossless? · validation · size limits',
          'Formats · sens · sans perte ? · validation · limites de taille',
        ],
        example: [
          'CSV export of requests for reporting (lossy); JSON export/import of a full organization (lossless, schema validated).',
          'Export CSV des demandes pour les rapports (avec perte) ; export/import JSON d’une organisation complète (sans perte, validé par schéma).',
        ],
      },
      {
        n: 8,
        required: true,
        only: ['Data / AI system'],
        label: ['Training and evaluation data provenance', 'Provenance des données d’entraînement et d’évaluation'],
        prompt: [
          'Where do training, evaluation and prompt data come from, and may you use them?',
          'D’où viennent les données d’entraînement, d’évaluation et de requêtes, et pouvez-vous les utiliser ?',
        ],
        explain: [
          'Models inherit the quality, bias and legal status of their data. Record sources, licenses or consent, and how datasets are versioned.',
          'Les modèles héritent de la qualité, des biais et du statut juridique de leurs données. Consignez sources, licences ou consentements, et le versionnement des jeux de données.',
        ],
        hint: [
          'Dataset · source · license/consent · personal data · versioning · refresh',
          'Jeu de données · source · licence/consentement · données personnelles · version · mise à jour',
        ],
        example: [
          'Evaluation set: 400 anonymized support tickets from 2025, approved by Legal, stored as dataset v3 with a checksum.',
          'Jeu d’évaluation : 400 billets de support anonymisés de 2025, approuvés par le service juridique, stockés en version 3 avec empreinte.',
        ],
      },
      {
        n: 9,
        required: true,
        only: ['Library / SDK'],
        label: ['Public API surface and compatibility', 'Surface publique et compatibilité'],
        prompt: [
          'What is the public API surface, and what compatibility do you promise?',
          'Quelle est la surface publique de l’API, et quelle compatibilité promettez-vous ?',
        ],
        explain: [
          'Everything consumers can import is a promise. Define what is public, the supported runtime versions, and how semantic versioning applies.',
          'Tout ce que les consommateurs peuvent importer est une promesse. Définissez ce qui est public, les versions d’exécution prises en charge et l’application du versionnement sémantique.',
        ],
        hint: [
          'Public modules · supported runtimes · semver policy · deprecation · changelog',
          'Modules publics · environnements pris en charge · politique semver · dépréciation · journal',
        ],
        example: [
          'Only exports from the package root are public; Node 20+; breaking changes only in major releases with a migration guide.',
          'Seules les exportations racine sont publiques ; Node 20+ ; changements incompatibles uniquement en version majeure avec guide de migration.',
        ],
      },
    ],
  },
  {
    id: 'quality',
    title: ['Nonfunctional requirements', 'Exigences non fonctionnelles'],
    description: [
      'Turn expectations into measurable targets.',
      'Transformez les attentes en objectifs mesurables.',
    ],
    guidance: [
      '“Fast”, “secure” and “scalable” are not requirements until they have a number, a measurement method and a condition. Pair every target with how it will be verified.',
      '« Rapide », « sécurisé » et « évolutif » ne deviennent des exigences qu’avec un chiffre, une méthode de mesure et une condition. Associez chaque objectif à sa vérification.',
    ],
    dependsOn: ['scope', 'architecture'],
    references: [
      {
        title: 'ISO/IEC 25010 — Product quality model',
        url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010',
      },
      {
        title: 'Google SRE — Service Level Objectives',
        url: 'https://sre.google/sre-book/service-level-objectives/',
      },
      { title: 'WCAG 2.2', url: 'https://www.w3.org/TR/WCAG22/' },
    ],
    diagrams: [
      {
        id: 'latency-budget',
        title: ['Latency budget', 'Budget de latence'],
        code: 'xychart-beta\n  title "p95 latency budget (ms)"\n  x-axis [Browser, API, Database, Rendering]\n  y-axis "Milliseconds" 0 --> 400\n  bar [120, 150, 60, 70]',
      },
      {
        id: 'degradation',
        title: ['Graceful degradation', 'Dégradation progressive'],
        code: 'flowchart LR\n  request[Request] --> healthy{Dependency healthy?}\n  healthy -- yes --> full[Full response]\n  healthy -- no --> cached[Serve cached data]\n  cached --> banner[Show degraded banner]',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        label: ['Latency and throughput targets', 'Objectifs de latence et débit'],
        prompt: [
          'How fast must the system respond, and how much load must it handle?',
          'À quelle vitesse le système doit-il répondre, et quelle charge doit-il supporter ?',
        ],
        explain: [
          'State targets as percentiles under a stated load, for example “p95 under 300 ms at 50 requests per second”. Averages hide slow experiences.',
          'Exprimez les objectifs en centiles sous une charge donnée, par exemple « p95 sous 300 ms à 50 requêtes par seconde ». Les moyennes masquent les expériences lentes.',
        ],
        hint: [
          'Operation · percentile · threshold · load condition · measurement point',
          'Opération · centile · seuil · condition de charge · point de mesure',
        ],
        example: [
          'Request list: p95 < 300 ms server time at 50 req/s; page interactive < 2.5 s on a mid-range laptop.',
          'Liste des demandes : p95 < 300 ms côté serveur à 50 req/s ; page interactive < 2,5 s sur un portable moyen.',
        ],
      },
      {
        n: 2,
        required: true,
        label: ['Concurrency and capacity', 'Concurrence et capacité'],
        prompt: [
          'How many concurrent users and how much data must be supported?',
          'Combien d’utilisateurs simultanés et quel volume de données faut-il prendre en charge ?',
        ],
        explain: [
          'Capacity targets turn the user counts from discovery into engineering numbers: sessions, requests per second, storage growth.',
          'Les objectifs de capacité traduisent les volumes d’utilisateurs en chiffres techniques : sessions, requêtes par seconde, croissance du stockage.',
        ],
        hint: [
          'Concurrent sessions · peak RPS · data volume · growth rate · headroom',
          'Sessions simultanées · pic de requêtes · volume de données · croissance · marge',
        ],
        example: [
          '250 concurrent sessions, 80 req/s peak, 50 GB of attachments in year one, with 2× headroom.',
          '250 sessions simultanées, pic de 80 req/s, 50 Go de pièces jointes la première année, avec une marge ×2.',
        ],
      },
      {
        n: 3,
        required: true,
        label: ['Availability target', 'Objectif de disponibilité'],
        prompt: [
          'How available must the system be?',
          'Quelle disponibilité le système doit-il offrir ?',
        ],
        explain: [
          'Availability is usually expressed as a monthly percentage. 99.9% allows about 43 minutes of downtime per month; higher targets cost more.',
          'La disponibilité s’exprime souvent en pourcentage mensuel. 99,9 % permet environ 43 minutes d’arrêt par mois ; viser plus haut coûte plus cher.',
        ],
        hint: [
          'Target % · measurement window · planned maintenance · business hours',
          'Cible % · période de mesure · maintenance planifiée · heures ouvrables',
        ],
        example: [
          '99.5% monthly during business hours (8:00–18:00 ET); planned maintenance announced 48 h ahead.',
          '99,5 % par mois pendant les heures ouvrables (8 h–18 h HE) ; maintenance annoncée 48 h à l’avance.',
        ],
      },
      {
        n: 4,
        label: ['Accessibility standard', 'Norme d’accessibilité'],
        prompt: [
          'Which accessibility standard must be met?',
          'Quelle norme d’accessibilité faut-il respecter ?',
        ],
        explain: [
          'WCAG 2.2 level AA is the usual baseline. Name the standard and how conformance will be checked (automated scans and manual tests).',
          'Le niveau AA des WCAG 2.2 est la référence habituelle. Nommez la norme et la façon de vérifier la conformité (analyses automatisées et tests manuels).',
        ],
        hint: ['Standard · level · scope · automated checks · manual audit', 'Norme · niveau · portée · vérifications automatiques · audit manuel'],
        example: [
          'WCAG 2.2 AA for all customer screens; axe checks in CI; manual screen-reader review before each release.',
          'WCAG 2.2 AA pour tous les écrans clients ; vérifications axe dans l’intégration continue ; revue au lecteur d’écran avant chaque version.',
        ],
        skip: ['API / service', 'Library / SDK'],
      },
      {
        n: 5,
        label: ['Scaling strategy', 'Stratégie de mise à l’échelle'],
        prompt: ['How will the system grow with demand?', 'Comment le système s’adaptera-t-il à la demande ?'],
        explain: [
          'Describe what scales horizontally, what scales vertically, and which component becomes the bottleneck first.',
          'Décrivez ce qui évolue horizontalement, verticalement, et quel composant deviendra le premier goulot d’étranglement.',
        ],
        hint: ['Scaling unit · trigger · limit · bottleneck · cost', 'Unité d’échelle · déclencheur · limite · goulot · coût'],
        example: [
          'API containers scale out at 70% CPU up to 6 instances; the database is the first bottleneck — review at 60% storage.',
          'Les conteneurs d’API s’étendent à 70 % de processeur jusqu’à 6 instances ; la base de données est le premier goulot — revue à 60 % de stockage.',
        ],
      },
      {
        n: 6,
        label: ['Resilience and recovery targets', 'Objectifs de résilience et reprise'],
        prompt: [
          'How should the system behave when parts fail?',
          'Comment le système doit-il se comporter en cas de défaillance partielle ?',
        ],
        explain: [
          'Define timeouts, retries, circuit breakers and degraded modes. Recovery targets (RPO/RTO) say how much data and time you can afford to lose.',
          'Définissez délais, nouvelles tentatives, disjoncteurs et modes dégradés. Les objectifs de reprise (RPO/RTO) indiquent les pertes de données et de temps acceptables.',
        ],
        hint: [
          'Failure mode · degraded behaviour · timeout/retry · RPO · RTO',
          'Mode de défaillance · comportement dégradé · délai/nouvel essai · RPO · RTO',
        ],
        example: [
          'If email is down, notifications queue for 24 h; database RPO 15 min, RTO 2 h.',
          'Si le courriel est indisponible, les notifications attendent 24 h ; RPO de la base 15 min, RTO 2 h.',
        ],
      },
      {
        n: 7,
        label: ['Maintainability requirements', 'Exigences de maintenabilité'],
        prompt: [
          'What makes the system easy to change safely?',
          'Qu’est-ce qui rend le système facile à modifier en toute sécurité ?',
        ],
        explain: [
          'Maintainability covers test coverage expectations, dependency update cadence, documentation and module boundaries.',
          'La maintenabilité couvre les attentes de couverture de tests, le rythme de mise à jour des dépendances, la documentation et les frontières des modules.',
        ],
        hint: [
          'Coverage targets · update cadence · documentation · complexity limits',
          'Couverture · rythme de mise à jour · documentation · limites de complexité',
        ],
        example: [
          'Domain code ≥ 80% branch coverage; dependencies updated monthly; each module has a README with its contracts.',
          'Code métier ≥ 80 % de couverture des branches ; dépendances mises à jour chaque mois ; chaque module a un README avec ses contrats.',
        ],
      },
      {
        n: 8,
        required: true,
        kind: 'table',
        label: ['Verification method for each target', 'Méthode de vérification par objectif'],
        prompt: [
          'How will each nonfunctional target be verified?',
          'Comment chaque objectif non fonctionnel sera-t-il vérifié ?',
        ],
        explain: [
          'A target without a verification method is a wish. Name the test, tool, environment and frequency for each target.',
          'Un objectif sans méthode de vérification reste un souhait. Nommez le test, l’outil, l’environnement et la fréquence pour chacun.',
        ],
        hint: ['Target · method · tool · environment · frequency', 'Objectif · méthode · outil · environnement · fréquence'],
        example: [
          'p95 < 300 ms | Load test | k6 | Staging | Before each release',
          'p95 < 300 ms | Test de charge | k6 | Préproduction | Avant chaque version',
        ],
        columns: [
          ['Target', 'Objectif'],
          ['Method', 'Méthode'],
          ['Tool', 'Outil'],
          ['Frequency', 'Fréquence'],
        ],
      },
      {
        n: 9,
        required: true,
        only: ['Data / AI system'],
        label: ['Model quality and evaluation thresholds', 'Qualité du modèle et seuils d’évaluation'],
        prompt: [
          'Which quality thresholds must model outputs meet before release?',
          'Quels seuils de qualité les résultats du modèle doivent-ils atteindre avant la mise en production ?',
        ],
        explain: [
          'Define task-specific metrics, the evaluation dataset, acceptable error rates and how regressions block a release.',
          'Définissez des métriques propres à la tâche, le jeu d’évaluation, les taux d’erreur acceptables et comment une régression bloque une version.',
        ],
        hint: [
          'Metric · dataset · threshold · human review sample · regression gate',
          'Métrique · jeu de données · seuil · échantillon de revue humaine · barrière de régression',
        ],
        example: [
          'Ticket classification F1 ≥ 0.85 on evaluation set v3; no category below 0.75; a release is blocked on a drop above 2 points.',
          'Classification des billets F1 ≥ 0,85 sur le jeu v3 ; aucune catégorie sous 0,75 ; une baisse de plus de 2 points bloque la version.',
        ],
      },
      {
        n: 10,
        only: ['Mobile application', 'Desktop application', 'Embedded / IoT'],
        label: ['Device resource constraints', 'Contraintes de ressources de l’appareil'],
        prompt: [
          'What limits apply to memory, storage, battery and startup time?',
          'Quelles limites s’appliquent à la mémoire, au stockage, à la batterie et au démarrage ?',
        ],
        explain: [
          'Devices have finite resources. Set budgets for startup time, memory, package size and energy use on the lowest supported device.',
          'Les appareils ont des ressources limitées. Fixez des budgets de démarrage, mémoire, taille de paquet et énergie sur l’appareil le moins puissant pris en charge.',
        ],
        hint: [
          'Lowest supported device · startup · memory · package size · battery',
          'Appareil minimal · démarrage · mémoire · taille · batterie',
        ],
        example: [
          'Cold start < 2 s on a 4 GB RAM Android device; install size < 40 MB; background sync at most every 15 minutes.',
          'Démarrage à froid < 2 s sur un Android à 4 Go de RAM ; installation < 40 Mo ; synchronisation en arrière-plan au plus toutes les 15 minutes.',
        ],
      },
    ],
  },
  {
    id: 'security',
    title: ['Security & privacy', 'Sécurité et confidentialité'],
    description: [
      'Know what you protect and who can access it.',
      'Définissez les protections et les accès.',
    ],
    guidance: [
      'Identify what is valuable, who might attack it and where trust changes. Every control should trace to a threat, and every privileged action should leave audit evidence. Ask your privacy and legal contacts which obligations apply — this template only prompts the questions.',
      'Identifiez ce qui a de la valeur, qui pourrait l’attaquer et où la confiance change. Chaque mesure se rattache à une menace et chaque action privilégiée laisse une trace d’audit. Demandez à vos contacts juridiques quelles obligations s’appliquent — ce modèle ne fait que poser les questions.',
    ],
    dependsOn: ['architecture', 'data'],
    references: [
      {
        title: 'OWASP Application Security Verification Standard',
        url: 'https://owasp.org/www-project-application-security-verification-standard/',
      },
      { title: 'OWASP Threat Modeling', url: 'https://owasp.org/www-community/Threat_Modeling' },
      {
        title: 'NIST SP 800-218 — Secure Software Development Framework',
        url: 'https://csrc.nist.gov/pubs/sp/800/218/final',
      },
      { title: 'OWASP Cheat Sheet Series', url: 'https://cheatsheetseries.owasp.org/' },
    ],
    diagrams: [
      {
        id: 'trust-boundaries',
        title: ['Trust boundaries', 'Frontières de confiance'],
        code: 'flowchart LR\n  subgraph internet[Untrusted: Internet]\n    browser[Browser]\n  end\n  subgraph zone[Trusted: Application zone]\n    api[API] --> db[(Database)]\n  end\n  subgraph ext[External providers]\n    idp[Identity provider]\n  end\n  browser -->|HTTPS and session cookie| api\n  api -->|OIDC| idp',
      },
      {
        id: 'oidc-sequence',
        title: ['Sign-in sequence (OIDC + PKCE)', 'Séquence de connexion (OIDC + PKCE)'],
        code: 'sequenceDiagram\n  actor User\n  participant App\n  participant IdP as Identity provider\n  User->>App: Sign in\n  App->>IdP: Authorization request (PKCE challenge)\n  IdP-->>User: Authenticate\n  IdP->>App: Authorization code\n  App->>IdP: Token request (PKCE verifier)\n  IdP-->>App: ID token\n  App-->>User: HttpOnly session cookie',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        kind: 'table',
        label: ['Assets and data classification', 'Actifs et classification des données'],
        prompt: [
          'Which data and assets need protection, and how sensitive are they?',
          'Quelles données et quels actifs faut-il protéger, et quelle est leur sensibilité ?',
        ],
        explain: [
          'Classify data (for example Public, Internal, Confidential, Restricted). The classification decides encryption, access, logging and retention rules.',
          'Classez les données (par exemple Public, Interne, Confidentiel, Restreint). La classification détermine le chiffrement, les accès, la journalisation et la conservation.',
        ],
        hint: ['Asset · classification · owner · location', 'Actif · classification · responsable · emplacement'],
        example: [
          'Request content | Confidential | Customer Experience | Primary database and backups',
          'Contenu des demandes | Confidentiel | Expérience client | Base principale et sauvegardes',
        ],
        columns: [
          ['Asset', 'Actif'],
          ['Classification', 'Classification'],
          ['Owner', 'Responsable'],
          ['Location', 'Emplacement'],
        ],
      },
      {
        n: 2,
        required: true,
        label: ['Threat model and trust boundaries', 'Menaces et frontières de confiance'],
        prompt: [
          'Where does trust change, and what threats apply there?',
          'Où la confiance change-t-elle, et quelles menaces s’y appliquent ?',
        ],
        explain: [
          'A threat model asks: what are we building, what can go wrong, what will we do about it, and did we do a good job? STRIDE is a helpful checklist at each boundary.',
          'Un modèle de menaces demande : que construisons-nous, qu’est-ce qui peut mal tourner, que ferons-nous, et l’avons-nous bien fait ? STRIDE aide à chaque frontière.',
        ],
        hint: [
          'Boundary · threat (STRIDE) · likelihood · control · residual risk',
          'Frontière · menace (STRIDE) · probabilité · mesure · risque résiduel',
        ],
        example: [
          'Browser→API: session hijacking (Spoofing) — HttpOnly SameSite cookies, CSRF origin checks. API→DB: cross-tenant reads — tenant filter enforced in the data layer.',
          'Navigateur→API : vol de session (usurpation) — cookies HttpOnly SameSite, vérification d’origine. API→BD : lecture entre clients — filtre imposé dans la couche de données.',
        ],
      },
      {
        n: 3,
        required: true,
        label: ['Authentication and session policy', 'Authentification et sessions'],
        prompt: [
          'How do users and services authenticate, and how are sessions managed?',
          'Comment les utilisateurs et services s’authentifient-ils, et comment les sessions sont-elles gérées ?',
        ],
        explain: [
          'Decide the identity source, sign-in methods, multi-factor requirements, session lifetime and how accounts are created and removed.',
          'Choisissez la source d’identité, les modes de connexion, les exigences multifacteur, la durée des sessions et la création et suppression des comptes.',
        ],
        hint: [
          'Identity provider · MFA · session lifetime · service credentials · provisioning',
          'Fournisseur d’identité · MFA · durée de session · identifiants de service · provisionnement',
        ],
        example: [
          'Company OIDC with MFA enforced by the IdP; 8-hour sessions in HttpOnly cookies; invitation-only provisioning.',
          'OIDC de l’entreprise avec MFA imposée par le fournisseur ; sessions de 8 h en cookies HttpOnly ; accès sur invitation seulement.',
        ],
      },
      {
        n: 4,
        required: true,
        kind: 'table',
        label: ['Role and permission matrix', 'Matrice des rôles et permissions'],
        prompt: ['Which roles exist, and what can each do?', 'Quels rôles existent, et que peut faire chacun ?'],
        explain: [
          'A role matrix makes least privilege reviewable. Enforce it on the server, never only in the interface.',
          'Une matrice des rôles rend le moindre privilège vérifiable. Appliquez-la côté serveur, jamais seulement dans l’interface.',
        ],
        hint: ['Role · allowed actions · denied actions · scope', 'Rôle · actions permises · actions refusées · portée'],
        example: [
          'Support agent | View and reply to assigned queues | Change organization settings | Assigned queues only',
          'Agent de support | Consulter et répondre aux files assignées | Modifier les paramètres d’organisation | Files assignées seulement',
        ],
        columns: [
          ['Role', 'Rôle'],
          ['Allowed', 'Permis'],
          ['Denied', 'Refusé'],
          ['Scope', 'Portée'],
        ],
      },
      {
        n: 5,
        label: ['Secrets and key management', 'Gestion des secrets et clés'],
        prompt: [
          'Where are secrets stored, and how are they rotated?',
          'Où les secrets sont-ils stockés, et comment sont-ils renouvelés ?',
        ],
        explain: [
          'Secrets (API keys, passwords, signing keys) never belong in code or logs. Name the secret store, who can read it and the rotation schedule.',
          'Les secrets (clés d’API, mots de passe, clés de signature) n’ont pas leur place dans le code ni les journaux. Nommez le coffre, qui y accède et le calendrier de renouvellement.',
        ],
        hint: ['Secret store · access · rotation · revocation · scanning', 'Coffre · accès · renouvellement · révocation · détection'],
        example: [
          'Secrets in the cloud key vault, injected at runtime; rotated every 90 days; CI runs secret scanning on every pull request.',
          'Secrets dans le coffre infonuagique, injectés à l’exécution ; renouvelés tous les 90 jours ; détection de secrets à chaque demande de fusion.',
        ],
      },
      {
        n: 6,
        label: ['Encryption requirements', 'Exigences de chiffrement'],
        prompt: [
          'What must be encrypted in transit and at rest?',
          'Qu’est-ce qui doit être chiffré en transit et au repos ?',
        ],
        explain: [
          'Use TLS for all network traffic and encryption at rest for stored data. Some fields may need application-level encryption with separate keys.',
          'Utilisez TLS pour tout le trafic réseau et le chiffrement au repos pour les données stockées. Certains champs exigent un chiffrement applicatif avec des clés distinctes.',
        ],
        hint: [
          'In transit · at rest · field-level · key ownership · algorithms',
          'En transit · au repos · par champ · propriété des clés · algorithmes',
        ],
        example: [
          'TLS 1.2+ everywhere; storage encryption by the database service; provider credentials encrypted with AES-256-GCM using an application key.',
          'TLS 1.2+ partout ; chiffrement du stockage par le service de base de données ; identifiants de fournisseurs chiffrés en AES-256-GCM avec une clé applicative.',
        ],
      },
      {
        n: 7,
        label: ['Audit and incident evidence', 'Audit et preuves d’incidents'],
        prompt: [
          'Which actions must be audited, and how is the evidence protected?',
          'Quelles actions doivent être auditées, et comment les preuves sont-elles protégées ?',
        ],
        explain: [
          'Audit logs answer “who did what, when?” for privileged and sensitive actions. They must be tamper-resistant and exclude secrets.',
          'Les journaux d’audit répondent à « qui a fait quoi, et quand ? » pour les actions sensibles. Ils doivent résister à l’altération et exclure les secrets.',
        ],
        hint: [
          'Audited actions · fields · retention · tamper resistance · access',
          'Actions auditées · champs · conservation · résistance à l’altération · accès',
        ],
        example: [
          'Audit role changes, exports and integration changes with actor, time and target; keep 1 year; admins read-only.',
          'Auditer les changements de rôle, exports et intégrations avec auteur, date et cible ; conserver 1 an ; lecture seule pour les administrateurs.',
        ],
      },
      {
        n: 8,
        label: ['Privacy and applicable obligations', 'Confidentialité et obligations applicables'],
        prompt: [
          'Which privacy or regulatory obligations might apply?',
          'Quelles obligations de confidentialité ou réglementaires pourraient s’appliquer ?',
        ],
        explain: [
          'Depending on users and data, obligations may include GDPR, Québec Law 25, PIPEDA, HIPAA, PCI DSS or contractual SOC 2 controls. List candidates and who confirms them — this is not legal advice.',
          'Selon les utilisateurs et les données, les obligations peuvent inclure le RGPD, la Loi 25 du Québec, la LPRPDE, HIPAA, PCI DSS ou des contrôles SOC 2 contractuels. Listez les candidats et qui les confirme — ceci n’est pas un avis juridique.',
        ],
        hint: [
          'Jurisdictions · personal data · candidate regulations · confirming authority · DPIA/PIA',
          'Juridictions · données personnelles · réglementations possibles · autorité de confirmation · EFVP',
        ],
        example: [
          'Customers in Québec and the EU: Law 25 and GDPR likely apply. Privacy officer to confirm and complete a privacy impact assessment by week 4.',
          'Clients au Québec et dans l’UE : la Loi 25 et le RGPD s’appliquent probablement. Le responsable de la protection des renseignements confirme et réalise une EFVP d’ici la semaine 4.',
        ],
      },
      {
        n: 9,
        required: true,
        only: ['Data / AI system'],
        label: ['AI misuse and prompt-injection controls', 'Contrôles contre l’abus d’IA et l’injection de requêtes'],
        prompt: [
          'How are model inputs, tools and outputs protected against misuse?',
          'Comment les entrées, outils et sorties du modèle sont-ils protégés contre les abus ?',
        ],
        explain: [
          'Treat retrieved documents and user input as untrusted. Limit what tools a model can call, validate outputs, and keep a human in the loop for consequential actions.',
          'Traitez les documents récupérés et les saisies comme non fiables. Limitez les outils accessibles au modèle, validez les sorties et gardez un humain dans la boucle pour les actions importantes.',
        ],
        hint: [
          'Untrusted inputs · tool permissions · output validation · human approval · abuse monitoring',
          'Entrées non fiables · permissions des outils · validation des sorties · approbation humaine · surveillance',
        ],
        example: [
          'Retrieved content is passed as data only; the model can read but not send emails; outputs are schema-validated and reviewed before use.',
          'Le contenu récupéré est transmis comme donnée ; le modèle peut lire mais pas envoyer de courriels ; les sorties sont validées par schéma et revues avant usage.',
        ],
      },
      {
        n: 10,
        only: ['Mobile application', 'Desktop application', 'Embedded / IoT'],
        label: ['Device and client platform security', 'Sécurité de l’appareil et de la plateforme cliente'],
        prompt: [
          'How is data on the device protected, and how are updates trusted?',
          'Comment les données sur l’appareil sont-elles protégées, et comment les mises à jour sont-elles authentifiées ?',
        ],
        explain: [
          'Client devices can be lost or tampered with. Use platform secure storage, sign releases and updates, and plan remote session revocation.',
          'Les appareils peuvent être perdus ou altérés. Utilisez le stockage sécurisé de la plateforme, signez les versions et mises à jour, et prévoyez la révocation à distance des sessions.',
        ],
        hint: [
          'Secure storage · code signing · update channel · jailbreak/root policy · remote revoke',
          'Stockage sécurisé · signature du code · canal de mise à jour · politique root · révocation',
        ],
        example: [
          'Tokens in Keychain/Keystore; signed builds; updates only through the store; sessions revocable from the admin console.',
          'Jetons dans Keychain/Keystore ; versions signées ; mises à jour via la boutique uniquement ; sessions révocables depuis la console d’administration.',
        ],
      },
    ],
  },
];
