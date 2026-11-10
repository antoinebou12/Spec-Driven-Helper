import type { ModuleDraft, ProjectType } from '../template-types';

const devices: ProjectType[] = ['Mobile application', 'Desktop application', 'Embedded / IoT'];

export const deliveryModules: ModuleDraft[] = [
  {
    id: 'testing',
    title: ['Testing & quality', 'Tests et qualité'],
    description: [
      'Connect every important promise to a test.',
      'Reliez chaque promesse importante à un test.',
    ],
    guidance: [
      'Aim for many fast tests of domain rules, fewer integration tests against real dependencies, and a small set of end-to-end journeys. Link each test item to the requirements it verifies so readiness can show gaps.',
      'Visez beaucoup de tests rapides des règles métier, moins de tests d’intégration avec les vraies dépendances et quelques parcours de bout en bout. Reliez chaque test aux exigences qu’il vérifie pour révéler les manques.',
    ],
    dependsOn: ['scope', 'quality', 'security'],
    references: [
      {
        title: 'The Practical Test Pyramid',
        url: 'https://martinfowler.com/articles/practical-test-pyramid.html',
      },
      {
        title: 'OWASP Web Security Testing Guide',
        url: 'https://owasp.org/www-project-web-security-testing-guide/',
      },
      { title: 'Playwright', url: 'https://playwright.dev/' },
      { title: 'axe-core', url: 'https://github.com/dequelabs/axe-core' },
    ],
    diagrams: [
      {
        id: 'test-pyramid',
        title: ['Test pyramid', 'Pyramide des tests'],
        code: 'flowchart TB\n  e2e[End-to-end: few critical journeys]\n  integration[Integration and contract: real dependencies]\n  unit[Unit: domain rules, many and fast]\n  e2e --- integration\n  integration --- unit',
      },
      {
        id: 'requirement-tests',
        title: ['Requirement to tests', 'Exigence vers tests'],
        code: 'flowchart LR\n  req[REQ-001] -->|verified by| unit[TEST-001 unit]\n  req -->|verified by| e2e[TEST-002 end-to-end]',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        label: ['Test pyramid and ownership', 'Pyramide des tests et responsables'],
        prompt: [
          'What mix of tests will you write, and who owns them?',
          'Quelle combinaison de tests écrirez-vous, et qui en est responsable ?',
        ],
        explain: [
          'The test pyramid balances speed and confidence. State roughly how many tests of each kind you expect and who maintains them.',
          'La pyramide des tests équilibre rapidité et confiance. Indiquez la proportion attendue de chaque type de test et qui les maintient.',
        ],
        hint: ['Layers · proportion · owner · run time budget', 'Niveaux · proportion · responsable · budget de durée'],
        example: [
          'Unit tests for domain rules (developers, < 30 s); API integration tests with a real database (< 3 min); 5 end-to-end journeys (QA lead).',
          'Tests unitaires des règles métier (développeurs, < 30 s) ; tests d’intégration API avec vraie base (< 3 min) ; 5 parcours de bout en bout (responsable QA).',
        ],
      },
      {
        n: 2,
        required: true,
        label: ['Unit test boundaries', 'Périmètre des tests unitaires'],
        prompt: ['What do unit tests cover, and what do they avoid?', 'Que couvrent les tests unitaires, et qu’évitent-ils ?'],
        explain: [
          'Unit tests check small pieces of logic without networks or databases. Focus them on rules and calculations where mistakes are likely.',
          'Les tests unitaires vérifient de petites portions de logique sans réseau ni base de données. Concentrez-les sur les règles et calculs sujets aux erreurs.',
        ],
        hint: ['Covered logic · excluded concerns · mocking policy · coverage target', 'Logique couverte · exclusions · simulations · couverture'],
        example: [
          'Cover state transitions, permission checks and validation; no mocks of our own domain code; 80% branch coverage for packages/shared.',
          'Couvrir transitions d’état, contrôles de permissions et validation ; pas de simulation du code métier ; 80 % de couverture des branches pour packages/shared.',
        ],
      },
      {
        n: 3,
        required: true,
        label: ['Integration and contract tests', 'Tests d’intégration et de contrat'],
        prompt: [
          'How will you test real dependencies and API contracts?',
          'Comment testerez-vous les vraies dépendances et les contrats d’API ?',
        ],
        explain: [
          'Integration tests run against real databases and services (often in containers). Contract tests check that providers and consumers agree on API shapes.',
          'Les tests d’intégration s’exécutent contre de vraies bases et services (souvent en conteneurs). Les tests de contrat vérifient l’accord entre fournisseurs et consommateurs d’API.',
        ],
        hint: ['Real dependencies · environment · contract source · provider stubs', 'Dépendances réelles · environnement · source du contrat · substituts'],
        example: [
          'API tests run against MongoDB in Docker; the OpenAPI document is validated against responses; email provider replaced by a recorded contract stub.',
          'Les tests API s’exécutent contre MongoDB dans Docker ; le document OpenAPI est validé contre les réponses ; le fournisseur de courriel est remplacé par un substitut de contrat.',
        ],
      },
      {
        n: 4,
        required: true,
        label: ['End-to-end acceptance journeys', 'Parcours de validation de bout en bout'],
        prompt: [
          'Which complete journeys prove the system works?',
          'Quels parcours complets prouvent que le système fonctionne ?',
        ],
        explain: [
          'End-to-end tests drive the real interface through critical journeys, including at least one denied or failing path. Keep the set small and reliable.',
          'Les tests de bout en bout pilotent la vraie interface dans les parcours critiques, dont au moins un chemin refusé ou en échec. Gardez un ensemble réduit et fiable.',
        ],
        hint: ['Journey · requirements covered · negative path · browsers/devices', 'Parcours · exigences couvertes · cas négatif · navigateurs/appareils'],
        example: [
          'Sign in → submit request → agent replies → customer sees reply (REQ-001, REQ-004); cross-organization access denied (REQ-002).',
          'Connexion → soumission → réponse de l’agent → le client voit la réponse (REQ-001, REQ-004) ; accès entre organisations refusé (REQ-002).',
        ],
      },
      {
        n: 5,
        label: ['Performance and security tests', 'Tests de performance et sécurité'],
        prompt: [
          'How will performance and security be tested?',
          'Comment la performance et la sécurité seront-elles testées ?',
        ],
        explain: [
          'Performance tests check the targets from the nonfunctional section. Security tests combine automated scanning with targeted tests of authorization rules.',
          'Les tests de performance vérifient les objectifs non fonctionnels. Les tests de sécurité combinent analyse automatisée et tests ciblés des règles d’autorisation.',
        ],
        hint: ['Load profile · tools · SAST/DAST · dependency scan · pen test cadence', 'Profil de charge · outils · SAST/DAST · analyse des dépendances · tests d’intrusion'],
        example: [
          'k6 load test at 2× expected peak before release; dependency and secret scanning in CI; external penetration test before general availability.',
          'Test de charge k6 à 2× le pic prévu avant chaque version ; analyse des dépendances et des secrets en CI ; test d’intrusion externe avant la disponibilité générale.',
        ],
      },
      {
        n: 6,
        skip: ['API / service', 'Library / SDK'],
        label: ['Accessibility tests', 'Tests d’accessibilité'],
        prompt: ['How will accessibility be verified?', 'Comment l’accessibilité sera-t-elle vérifiée ?'],
        explain: [
          'Automated tools catch roughly a third of issues. Combine them with keyboard walkthroughs and screen-reader checks of each journey.',
          'Les outils automatisés détectent environ un tiers des problèmes. Combinez-les avec des parcours au clavier et des vérifications au lecteur d’écran.',
        ],
        hint: ['Automated checks · manual keyboard pass · screen readers · acceptance threshold', 'Vérifications automatiques · passage clavier · lecteurs d’écran · seuil'],
        example: [
          'axe checks in every end-to-end test (no serious violations); manual NVDA pass on the three main journeys each release.',
          'Vérifications axe dans chaque test de bout en bout (aucune violation grave) ; passage manuel NVDA sur les trois parcours principaux à chaque version.',
        ],
      },
      {
        n: 7,
        label: ['Fixtures and test data', 'Jeux de données de test'],
        prompt: [
          'Where does test data come from, and how is it kept safe?',
          'D’où viennent les données de test, et comment restent-elles sûres ?',
        ],
        explain: [
          'Use generated or anonymized data. Never copy production personal data into test environments without an approved process.',
          'Utilisez des données générées ou anonymisées. Ne copiez jamais de données personnelles de production vers les tests sans processus approuvé.',
        ],
        hint: ['Source · generation · anonymization · reset strategy · ownership', 'Source · génération · anonymisation · réinitialisation · responsable'],
        example: [
          'Seed script creates 3 organizations and 50 requests with synthetic names; each test run uses a fresh database.',
          'Un script crée 3 organisations et 50 demandes aux noms fictifs ; chaque exécution utilise une base neuve.',
        ],
      },
      {
        n: 8,
        required: true,
        label: ['Quality gates and release criteria', 'Seuils qualité et critères de livraison'],
        prompt: [
          'What must be true before a change can merge or release?',
          'Que faut-il vérifier avant qu’un changement soit fusionné ou livré ?',
        ],
        explain: [
          'Quality gates are automatic checks that block a merge or release, such as passing tests, coverage, lint and security scans.',
          'Les seuils qualité sont des vérifications automatiques qui bloquent une fusion ou une livraison : tests réussis, couverture, lint et analyses de sécurité.',
        ],
        hint: ['Merge gates · release gates · exceptions process · owner', 'Barrières de fusion · barrières de livraison · exceptions · responsable'],
        example: [
          'Merge: lint, typecheck, unit and integration tests, no high-severity vulnerabilities. Release: end-to-end suite green and product owner sign-off.',
          'Fusion : lint, vérification des types, tests unitaires et d’intégration, aucune vulnérabilité grave. Livraison : suite de bout en bout réussie et accord du responsable produit.',
        ],
      },
      {
        n: 9,
        required: true,
        only: devices,
        kind: 'table',
        label: ['Device and platform test matrix', 'Matrice de tests appareils et plateformes'],
        prompt: [
          'Which devices, OS versions and hardware must be tested?',
          'Quels appareils, versions de système et matériels faut-il tester ?',
        ],
        explain: [
          'List the supported platforms and the representative devices you will test on, including the lowest supported specification.',
          'Listez les plateformes prises en charge et les appareils représentatifs testés, y compris la configuration minimale.',
        ],
        hint: ['Platform · versions · devices · automated or manual', 'Plateforme · versions · appareils · automatisé ou manuel'],
        example: [
          'Android | 12–15 | Pixel 6, Galaxy A14 | Automated on device farm',
          'Android | 12–15 | Pixel 6, Galaxy A14 | Automatisé sur ferme d’appareils',
        ],
        columns: [
          ['Platform', 'Plateforme'],
          ['Versions', 'Versions'],
          ['Devices', 'Appareils'],
          ['Method', 'Méthode'],
        ],
      },
      {
        n: 10,
        required: true,
        only: ['Data / AI system'],
        label: ['Model evaluation and regression suite', 'Évaluation et régression du modèle'],
        prompt: [
          'How are model or prompt changes evaluated before release?',
          'Comment les changements de modèle ou de requêtes sont-ils évalués avant la mise en production ?',
        ],
        explain: [
          'Treat prompts and model versions like code: a fixed evaluation set, automated scoring, and human review of a sample before any change ships.',
          'Traitez requêtes et versions de modèle comme du code : jeu d’évaluation fixe, notation automatisée et revue humaine d’un échantillon avant toute livraison.',
        ],
        hint: ['Eval dataset · scoring · human sample · pass threshold · history', 'Jeu d’évaluation · notation · échantillon humain · seuil · historique'],
        example: [
          'Each prompt change runs 400 evaluation cases in CI; scores stored per version; 30 random outputs reviewed by support leads.',
          'Chaque changement de requête exécute 400 cas d’évaluation en CI ; scores conservés par version ; 30 sorties aléatoires revues par les responsables du support.',
        ],
      },
    ],
  },
  {
    id: 'delivery',
    title: ['Delivery & environments', 'Livraison et environnements'],
    description: ['Make delivery repeatable.', 'Rendez la livraison reproductible.'],
    guidance: [
      'Anyone on the team should be able to go from a clean machine to a running system and from a merged change to production by following written steps. Keep configuration in the environment, not in code.',
      'Toute personne de l’équipe doit pouvoir passer d’une machine vierge à un système fonctionnel, et d’un changement fusionné à la production, en suivant des étapes écrites. Gardez la configuration dans l’environnement, pas dans le code.',
    ],
    dependsOn: ['architecture', 'technology'],
    references: [
      { title: 'The Twelve-Factor App', url: 'https://12factor.net/' },
      { title: 'Docker Compose', url: 'https://docs.docker.com/compose/' },
      { title: 'DORA research', url: 'https://dora.dev/' },
    ],
    diagrams: [
      {
        id: 'pipeline',
        title: ['CI/CD pipeline', 'Pipeline CI/CD'],
        code: 'flowchart LR\n  commit[Commit] --> checks[Lint and typecheck]\n  checks --> tests[Tests]\n  tests --> scan[Dependency and secret scan]\n  scan --> build[Build image]\n  build --> staging[Deploy to staging]\n  staging --> approve{Approval}\n  approve --> prod[Production]',
      },
      {
        id: 'branching',
        title: ['Branching and releases', 'Branches et versions'],
        code: 'gitGraph\n  commit\n  branch feature\n  checkout feature\n  commit\n  checkout main\n  merge feature\n  commit tag: "v1.0.0"',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        label: ['Development test and production environments', 'Environnements développement test et production'],
        prompt: [
          'Which environments exist, and what is each for?',
          'Quels environnements existent, et à quoi sert chacun ?',
        ],
        explain: [
          'Describe each environment’s purpose, data, access and how closely it matches production.',
          'Décrivez l’objectif, les données, les accès de chaque environnement et sa proximité avec la production.',
        ],
        hint: ['Environment · purpose · data · access · parity with production', 'Environnement · objectif · données · accès · parité avec la production'],
        example: [
          'Local (Docker Compose, seed data), staging (production-like, synthetic data, team access), production (customer data, on-call access only).',
          'Local (Docker Compose, données d’exemple), préproduction (comme la production, données fictives, accès équipe), production (données clients, accès astreinte seulement).',
        ],
      },
      {
        n: 2,
        required: true,
        label: ['Environment configuration and secrets', 'Configuration et secrets par environnement'],
        prompt: [
          'How is configuration supplied to each environment?',
          'Comment la configuration est-elle fournie à chaque environnement ?',
        ],
        explain: [
          'Configuration that differs between environments comes from environment variables or a configuration service, never from code. Document every variable.',
          'La configuration propre à chaque environnement provient de variables d’environnement ou d’un service de configuration, jamais du code. Documentez chaque variable.',
        ],
        hint: ['Variables · defaults · secret source · validation at start-up', 'Variables · valeurs par défaut · source des secrets · validation au démarrage'],
        example: [
          '.env.example lists every variable; secrets come from the vault; the API refuses to start if ENCRYPTION_KEY is missing.',
          '.env.example liste chaque variable ; les secrets viennent du coffre ; l’API refuse de démarrer si ENCRYPTION_KEY manque.',
        ],
      },
      {
        n: 3,
        required: true,
        label: ['CI/CD pipeline', 'Pipeline CI/CD'],
        prompt: [
          'How do changes move from commit to production?',
          'Comment les changements passent-ils du commit à la production ?',
        ],
        explain: [
          'List pipeline stages, what each checks, where artifacts are stored and who approves promotion to production.',
          'Listez les étapes du pipeline, ce que chacune vérifie, où les artefacts sont stockés et qui approuve la mise en production.',
        ],
        hint: ['Stages · triggers · artifacts · approvals · deploy strategy', 'Étapes · déclencheurs · artefacts · approbations · stratégie de déploiement'],
        example: [
          'GitHub Actions: lint → tests → scans → image build → staging deploy → manual approval → rolling production deploy.',
          'GitHub Actions : lint → tests → analyses → construction de l’image → déploiement en préproduction → approbation manuelle → déploiement progressif en production.',
        ],
      },
      {
        n: 4,
        label: ['Infrastructure and ownership', 'Infrastructure et responsables'],
        prompt: [
          'How is infrastructure defined, and who owns it?',
          'Comment l’infrastructure est-elle définie, et qui en est responsable ?',
        ],
        explain: [
          'Infrastructure as code makes environments reproducible and reviewable. Name the tool, repository and owning team.',
          'L’infrastructure en code rend les environnements reproductibles et vérifiables. Nommez l’outil, le dépôt et l’équipe responsable.',
        ],
        hint: ['IaC tool · repository · state storage · owner · change review', 'Outil IaC · dépôt · stockage de l’état · responsable · revue'],
        example: [
          'Terraform in the platform-infra repository, reviewed by Platform Engineering; state in an encrypted bucket.',
          'Terraform dans le dépôt platform-infra, revu par l’Ingénierie plateforme ; état dans un compartiment chiffré.',
        ],
      },
      {
        n: 5,
        skip: ['Mobile application', 'Embedded / IoT', 'Library / SDK'],
        label: ['Docker installation', 'Installation Docker'],
        prompt: [
          'How is the system installed and run with Docker?',
          'Comment le système s’installe-t-il et fonctionne-t-il avec Docker ?',
        ],
        explain: [
          'A Docker Compose setup is the fastest way to run everything consistently. Describe services, volumes, ports and health checks.',
          'Docker Compose est le moyen le plus rapide de tout exécuter de façon cohérente. Décrivez services, volumes, ports et contrôles de santé.',
        ],
        hint: ['Services · images · volumes · ports · health checks · upgrade steps', 'Services · images · volumes · ports · contrôles de santé · mise à niveau'],
        example: [
          '`docker compose up -d` starts app, worker and MongoDB; data persists in the mongo-data volume; the app waits for a healthy database.',
          '`docker compose up -d` démarre l’application, le traitement et MongoDB ; les données persistent dans le volume mongo-data ; l’application attend une base saine.',
        ],
      },
      {
        n: 6,
        label: ['Non-Docker platform prerequisites', 'Prérequis par plateforme sans Docker'],
        prompt: [
          'What is needed to install the system without Docker on each platform?',
          'Que faut-il pour installer le système sans Docker sur chaque plateforme ?',
        ],
        explain: [
          'List prerequisites and commands for Windows, macOS and Linux: runtime versions, databases, build tools and environment setup.',
          'Listez les prérequis et commandes pour Windows, macOS et Linux : versions d’exécution, bases de données, outils de construction et configuration.',
        ],
        hint: ['Per-OS prerequisites · versions · install commands · verification', 'Prérequis par système · versions · commandes · vérification'],
        example: [
          'Node.js 24 and pnpm 11 on all platforms; MongoDB 8 via winget (Windows), Homebrew (macOS) or the official apt repository (Linux).',
          'Node.js 24 et pnpm 11 partout ; MongoDB 8 via winget (Windows), Homebrew (macOS) ou le dépôt apt officiel (Linux).',
        ],
      },
      {
        n: 7,
        required: true,
        label: ['Migration and rollback plan', 'Plan de migration et retour arrière'],
        prompt: [
          'How are releases rolled out, and how are they rolled back?',
          'Comment les versions sont-elles déployées, et comment revient-on en arrière ?',
        ],
        explain: [
          'Every release needs a way back. Describe backups before migration, compatible schema changes and the exact rollback steps.',
          'Chaque version doit pouvoir être annulée. Décrivez les sauvegardes avant migration, les changements de schéma compatibles et les étapes exactes de retour arrière.',
        ],
        hint: ['Pre-release backup · rollout strategy · rollback trigger · rollback steps', 'Sauvegarde préalable · stratégie de déploiement · déclencheur · étapes de retour'],
        example: [
          'Back up before migration; deploy to 10% then 100%; roll back to the previous image tag if the error rate exceeds 2% for 5 minutes.',
          'Sauvegarder avant la migration ; déployer à 10 % puis 100 % ; revenir à l’image précédente si le taux d’erreur dépasse 2 % pendant 5 minutes.',
        ],
      },
      {
        n: 8,
        required: true,
        only: ['Mobile application', 'Desktop application', 'Library / SDK', 'Embedded / IoT'],
        label: ['Distribution, packaging and signing', 'Distribution, empaquetage et signature'],
        prompt: [
          'How is the software packaged, signed and distributed?',
          'Comment le logiciel est-il empaqueté, signé et distribué ?',
        ],
        explain: [
          'Installed software reaches users through stores, registries or update channels. Describe signing keys, release channels and review requirements.',
          'Un logiciel installé atteint les utilisateurs par des boutiques, registres ou canaux de mise à jour. Décrivez clés de signature, canaux de publication et exigences de revue.',
        ],
        hint: ['Channel · signing · versioning · staged rollout · store review', 'Canal · signature · versions · déploiement progressif · revue de la boutique'],
        example: [
          'Published to npm with provenance from CI; signed tags; beta channel for one week before latest.',
          'Publié sur npm avec provenance depuis la CI ; étiquettes signées ; canal bêta pendant une semaine avant la version stable.',
        ],
      },
    ],
  },
  {
    id: 'operations',
    title: ['Operations & observability', 'Exploitation et observabilité'],
    description: ['Plan for the day after launch.', 'Préparez le lendemain du lancement.'],
    guidance: [
      'Define what “healthy” means in numbers, instrument the system to measure it, and make sure a named person is alerted when it is not. Practise restores and incidents before you need them.',
      'Définissez la « bonne santé » en chiffres, instrumentez le système pour la mesurer et assurez-vous qu’une personne nommée soit alertée sinon. Exercez restaurations et incidents avant d’en avoir besoin.',
    ],
    dependsOn: ['quality', 'delivery'],
    references: [
      { title: 'OpenTelemetry documentation', url: 'https://opentelemetry.io/docs/' },
      {
        title: 'Google SRE — Managing incidents',
        url: 'https://sre.google/sre-book/managing-incidents/',
      },
      {
        title: 'Google SRE — Monitoring distributed systems',
        url: 'https://sre.google/sre-book/monitoring-distributed-systems/',
      },
    ],
    diagrams: [
      {
        id: 'incident-flow',
        title: ['Incident flow', 'Déroulement d’un incident'],
        code: 'flowchart TD\n  alert[Alert fires] --> ack[On-call acknowledges]\n  ack --> sev{Severity?}\n  sev -- SEV1 --> incident[Declare incident and page commander]\n  sev -- SEV3 --> ticket[Create ticket]\n  incident --> mitigate[Mitigate]\n  mitigate --> review[Blameless review]',
      },
      {
        id: 'telemetry',
        title: ['Telemetry pipeline', 'Chaîne de télémétrie'],
        code: 'flowchart LR\n  app[Application] -->|OTLP traces| collector[OpenTelemetry collector]\n  app -->|JSON logs| logs[(Log store)]\n  app -->|metrics| metrics[(Metrics store)]\n  collector --> traces[(Trace store)]\n  metrics --> alerts[Alert rules]',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        label: ['SLIs SLOs and SLA targets', 'Indicateurs SLI objectifs SLO et SLA'],
        prompt: [
          'Which service levels will you measure and promise?',
          'Quels niveaux de service mesurerez-vous et promettrez-vous ?',
        ],
        explain: [
          'An SLI is a measurement (for example, the share of successful requests), an SLO is your internal target, and an SLA is a contractual promise with consequences.',
          'Un SLI est une mesure (par exemple la part de requêtes réussies), un SLO votre objectif interne et un SLA une promesse contractuelle avec conséquences.',
        ],
        hint: ['SLI definition · SLO target · window · error budget · SLA (if any)', 'Définition du SLI · cible SLO · période · budget d’erreur · SLA (le cas échéant)'],
        example: [
          'SLI: share of API requests returning < 500 within 1 s. SLO: 99.5% over 28 days. No external SLA in release 1.',
          'SLI : part des requêtes API sans erreur 5xx en moins de 1 s. SLO : 99,5 % sur 28 jours. Pas de SLA externe en version 1.',
        ],
      },
      {
        n: 2,
        required: true,
        label: ['Logs metrics and traces', 'Journaux métriques et traces'],
        prompt: [
          'What telemetry will the system emit?',
          'Quelle télémétrie le système émettra-t-il ?',
        ],
        explain: [
          'Structured logs explain events, metrics show trends, and traces follow a request across components. Never log secrets or unnecessary personal data.',
          'Les journaux structurés expliquent les événements, les métriques montrent les tendances et les traces suivent une requête entre composants. Ne journalisez jamais de secrets ni de données personnelles inutiles.',
        ],
        hint: ['Log format · redaction · key metrics · trace propagation · retention', 'Format des journaux · masquage · métriques clés · propagation des traces · conservation'],
        example: [
          'JSON logs with request IDs and redacted cookies; RED metrics per route; OpenTelemetry traces exported via OTLP; logs kept 30 days.',
          'Journaux JSON avec identifiants de requête et cookies masqués ; métriques RED par route ; traces OpenTelemetry exportées en OTLP ; journaux conservés 30 jours.',
        ],
      },
      {
        n: 3,
        required: true,
        skip: ['Library / SDK'],
        label: ['Alerts and on-call ownership', 'Alertes et astreinte'],
        prompt: [
          'Which conditions alert someone, and who responds?',
          'Quelles conditions déclenchent une alerte, et qui répond ?',
        ],
        explain: [
          'Alert on symptoms users feel (error rate, latency, SLO burn), not every internal metric. Each alert needs an owner and a runbook.',
          'Alertez sur les symptômes ressentis (taux d’erreur, latence, consommation du SLO), pas sur chaque métrique interne. Chaque alerte a un responsable et une procédure.',
        ],
        hint: ['Alert · threshold · severity · on-call rotation · runbook link', 'Alerte · seuil · gravité · rotation d’astreinte · lien vers la procédure'],
        example: [
          'Page on-call when the 1-hour SLO burn rate exceeds 14×; business-hours rotation of 4 engineers; each alert links to a runbook.',
          'Appeler l’astreinte si la consommation du SLO sur 1 h dépasse 14× ; rotation de 4 ingénieurs aux heures ouvrables ; chaque alerte renvoie à une procédure.',
        ],
      },
      {
        n: 4,
        label: ['Incident response and escalation', 'Réponse aux incidents et escalade'],
        prompt: [
          'How are incidents declared, managed and reviewed?',
          'Comment les incidents sont-ils déclarés, gérés et analysés ?',
        ],
        explain: [
          'Define severity levels, roles (commander, communications), customer communication and blameless post-incident reviews.',
          'Définissez les niveaux de gravité, les rôles (commandant, communication), la communication aux clients et les analyses post-incident sans blâme.',
        ],
        hint: ['Severity levels · roles · communication · review timeline', 'Niveaux de gravité · rôles · communication · délai d’analyse'],
        example: [
          'SEV1: all customers affected — incident commander paged, status page within 15 minutes, review within 5 business days.',
          'SEV1 : tous les clients touchés — commandant d’incident appelé, page d’état sous 15 minutes, analyse sous 5 jours ouvrables.',
        ],
      },
      {
        n: 5,
        label: ['Operational runbooks', 'Procédures d’exploitation'],
        prompt: [
          'Which runbooks do operators need?',
          'De quelles procédures les opérateurs ont-ils besoin ?',
        ],
        explain: [
          'Runbooks are step-by-step instructions for routine and emergency tasks, written so someone unfamiliar with the system can follow them.',
          'Les procédures sont des instructions pas à pas pour les tâches courantes et urgentes, rédigées pour qu’une personne ne connaissant pas le système puisse les suivre.',
        ],
        hint: ['Task · trigger · steps · verification · owner', 'Tâche · déclencheur · étapes · vérification · responsable'],
        example: [
          'Rotate provider credentials; restore from backup; drain and restart workers; revoke a compromised session.',
          'Renouveler les identifiants de fournisseurs ; restaurer une sauvegarde ; vider et redémarrer les traitements ; révoquer une session compromise.',
        ],
      },
      {
        n: 6,
        required: true,
        skip: ['Library / SDK'],
        label: ['Backup and restore verification', 'Vérification des sauvegardes et restauration'],
        prompt: [
          'How is data backed up, and how do you know restores work?',
          'Comment les données sont-elles sauvegardées, et comment savez-vous que les restaurations fonctionnent ?',
        ],
        explain: [
          'A backup that has never been restored is not a backup. Schedule restore tests and record how long they take.',
          'Une sauvegarde jamais restaurée n’est pas une sauvegarde. Planifiez des tests de restauration et notez leur durée.',
        ],
        hint: ['Scope · frequency · location · encryption · restore test cadence', 'Portée · fréquence · emplacement · chiffrement · fréquence des tests'],
        example: [
          'Nightly mongodump plus point-in-time recovery; encrypted off-site copies; quarterly restore test into staging (last: 42 minutes).',
          'mongodump chaque nuit et restauration à un instant donné ; copies chiffrées hors site ; test de restauration trimestriel en préproduction (dernier : 42 minutes).',
        ],
      },
      {
        n: 7,
        skip: ['Library / SDK'],
        label: ['Disaster recovery RPO and RTO', 'Reprise après sinistre RPO et RTO'],
        prompt: [
          'How much data and time can you afford to lose in a disaster?',
          'Quelle perte de données et de temps pouvez-vous accepter en cas de sinistre ?',
        ],
        explain: [
          'RPO is the maximum acceptable data loss; RTO is the maximum acceptable downtime. They decide backup frequency and standby infrastructure.',
          'Le RPO est la perte de données maximale acceptable ; le RTO la durée d’arrêt maximale. Ils déterminent la fréquence des sauvegardes et l’infrastructure de secours.',
        ],
        hint: ['RPO · RTO · scenario · standby region · DR test', 'RPO · RTO · scénario · région de secours · test de reprise'],
        example: [
          'Region outage: RPO 15 minutes, RTO 4 hours using restored backups in a secondary region; tested yearly.',
          'Panne de région : RPO 15 minutes, RTO 4 heures grâce aux sauvegardes restaurées dans une région secondaire ; testé chaque année.',
        ],
      },
      {
        n: 8,
        label: ['Operating cost and capacity review', 'Coûts et revue de capacité'],
        prompt: [
          'How will running costs and capacity be reviewed?',
          'Comment les coûts d’exploitation et la capacité seront-ils revus ?',
        ],
        explain: [
          'Set a review cadence for hosting and provider spend against the budget, and for capacity against growth forecasts.',
          'Fixez un rythme de revue des dépenses d’hébergement et de fournisseurs par rapport au budget, et de la capacité par rapport aux prévisions.',
        ],
        hint: ['Cost dashboard · budget alerts · review cadence · capacity forecast', 'Tableau de coûts · alertes budgétaires · rythme de revue · prévision de capacité'],
        example: [
          'Monthly cost review with Finance; alert at 80% of the AI budget; quarterly capacity forecast.',
          'Revue mensuelle des coûts avec la Finance ; alerte à 80 % du budget IA ; prévision de capacité trimestrielle.',
        ],
      },
      {
        n: 9,
        required: true,
        only: ['Data / AI system'],
        label: ['Model monitoring and drift', 'Surveillance du modèle et dérive'],
        prompt: [
          'How will you detect when model quality degrades in production?',
          'Comment détecterez-vous une dégradation de la qualité du modèle en production ?',
        ],
        explain: [
          'Input data and user behaviour change over time. Monitor output quality signals, input distributions and user feedback, and define when to retrain or roll back.',
          'Les données et comportements évoluent. Surveillez les signaux de qualité, la distribution des entrées et les retours des utilisateurs, et définissez quand réentraîner ou revenir en arrière.',
        ],
        hint: ['Quality signals · drift metrics · feedback loop · rollback trigger', 'Signaux de qualité · métriques de dérive · retours · déclencheur de retour'],
        example: [
          'Track the weekly share of reclassified tickets; alert above 12%; roll back to the previous prompt version on alert.',
          'Suivre la part hebdomadaire de billets reclassés ; alerte au-delà de 12 % ; retour à la version précédente de la requête en cas d’alerte.',
        ],
      },
      {
        n: 10,
        only: ['Mobile application', 'Desktop application'],
        label: ['Crash reporting and telemetry consent', 'Rapports de plantage et consentement à la télémétrie'],
        prompt: [
          'How are client crashes collected, and how is user consent handled?',
          'Comment les plantages clients sont-ils collectés, et comment le consentement est-il géré ?',
        ],
        explain: [
          'Crash reports and analytics help fix problems but may contain personal data. Ask for consent where required and minimize what is collected.',
          'Les rapports de plantage et analyses aident à corriger les problèmes mais peuvent contenir des données personnelles. Demandez le consentement si nécessaire et limitez la collecte.',
        ],
        hint: ['Tool · data collected · consent · retention · symbol upload', 'Outil · données collectées · consentement · conservation · symboles'],
        example: [
          'Crash reports without user identifiers; analytics opt-in on first launch; retained 90 days.',
          'Rapports de plantage sans identifiant utilisateur ; analyses avec consentement au premier lancement ; conservés 90 jours.',
        ],
      },
    ],
  },
  {
    id: 'governance',
    title: ['Governance & handoff', 'Gouvernance et transmission'],
    description: [
      'Make responsibilities and next steps explicit.',
      'Clarifiez les responsabilités et les prochaines étapes.',
    ],
    guidance: [
      'A specification is ready to hand off when responsibilities are named, open decisions are listed with owners, and coding agents have explicit instructions that preserve identifiers and escalate unresolved questions.',
      'Une spécification est prête à transmettre lorsque les responsabilités sont nommées, les décisions ouvertes listées avec un responsable et les agents de code disposent d’instructions explicites qui préservent les identifiants et remontent les questions ouvertes.',
    ],
    dependsOn: ['scope'],
    references: [
      { title: 'AGENTS.md', url: 'https://agents.md/' },
      { title: 'Claude Code memory and CLAUDE.md', url: 'https://code.claude.com/docs/en/memory' },
      {
        title: 'GitHub Copilot repository instructions',
        url: 'https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot',
      },
    ],
    diagrams: [
      {
        id: 'milestones',
        title: ['Delivery milestones', 'Jalons de livraison'],
        code: 'gantt\n  title Delivery milestones\n  dateFormat YYYY-MM-DD\n  section Specification\n  Baseline approved :done, spec, 2026-01-05, 14d\n  section Build\n  Pilot release :pilot, after spec, 45d\n  General availability :milestone, ga, after pilot, 0d',
      },
      {
        id: 'approval-flow',
        title: ['Approval flow', 'Circuit d’approbation'],
        code: 'flowchart LR\n  draft[Draft] --> proposal[Proposal]\n  proposal --> review{Reviewer decision}\n  review -- accept --> revision[New revision]\n  review -- reject --> archive[Kept for history]\n  revision --> baseline[Approved baseline]',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        kind: 'raci',
        label: ['RACI responsibilities', 'Responsabilités RACI'],
        prompt: [
          'Who is responsible, accountable, consulted and informed for key activities?',
          'Qui réalise, approuve, est consulté et informé pour les activités clés ?',
        ],
        explain: [
          'A RACI matrix removes ambiguity: exactly one Accountable person per activity, at least one Responsible, and clear lists of who is consulted or informed.',
          'Une matrice RACI lève l’ambiguïté : exactement une personne qui approuve par activité, au moins une qui réalise, et des listes claires de personnes consultées ou informées.',
        ],
        hint: ['One A per row · activities cover spec, build, release, operate', 'Un seul A par ligne · activités : spécification, réalisation, livraison, exploitation'],
        example: [
          'Approve baseline | Tech lead | Product owner | Security | Support',
          'Approuver la référence | Responsable technique | Responsable produit | Sécurité | Support',
        ],
      },
      {
        n: 2,
        required: true,
        label: ['Reviewers and approvals', 'Réviseurs et approbations'],
        prompt: [
          'Who reviews each part of the specification, and who approves the baseline?',
          'Qui revoit chaque partie de la spécification, et qui approuve la référence ?',
        ],
        explain: [
          'Assign reviewers by expertise (security reviews the threat model, operations reviews SLOs). Approved baselines are immutable, so name who may approve them.',
          'Attribuez les revues selon l’expertise (la sécurité revoit les menaces, l’exploitation les SLO). Les références approuvées sont immuables : nommez qui peut les approuver.',
        ],
        hint: ['Section · reviewer · approver · criteria', 'Section · réviseur · approbateur · critères'],
        example: [
          'Security section: Security architect. Operations: SRE lead. Baseline approval: product owner and tech lead.',
          'Section sécurité : architecte sécurité. Exploitation : responsable SRE. Approbation de la référence : responsable produit et responsable technique.',
        ],
      },
      {
        n: 3,
        label: ['Milestones and dependencies', 'Jalons et dépendances'],
        prompt: [
          'What are the delivery milestones and their dependencies?',
          'Quels sont les jalons de livraison et leurs dépendances ?',
        ],
        explain: [
          'Link milestones to the requirements they deliver and to external dependencies, so slips are visible early.',
          'Reliez les jalons aux exigences livrées et aux dépendances externes pour repérer tôt les retards.',
        ],
        hint: ['Milestone · date · requirements · dependencies · owner', 'Jalon · date · exigences · dépendances · responsable'],
        example: [
          'Pilot (June 15): REQ-001–REQ-006; depends on the identity team’s OIDC client.',
          'Pilote (15 juin) : REQ-001 à REQ-006 ; dépend du client OIDC de l’équipe identité.',
        ],
      },
      {
        n: 4,
        required: true,
        label: ['Readiness and unresolved decisions', 'Préparation et décisions ouvertes'],
        prompt: [
          'Which decisions remain open, and who will resolve them?',
          'Quelles décisions restent ouvertes, et qui les tranchera ?',
        ],
        explain: [
          'Listing open decisions with owners and deadlines is better than hiding them. Implementation can proceed on settled parts while these are resolved.',
          'Lister les décisions ouvertes avec responsable et échéance vaut mieux que les cacher. La réalisation peut avancer sur les parties stables pendant leur résolution.',
        ],
        hint: ['Decision · options · owner · deadline · blocking?', 'Décision · options · responsable · échéance · bloquante ?'],
        example: [
          'Email provider (SES or Postmark) — owner: tech lead — by week 2 — blocks notifications only.',
          'Fournisseur de courriel (SES ou Postmark) — responsable : responsable technique — semaine 2 — bloque seulement les notifications.',
        ],
      },
      {
        n: 5,
        label: ['Contributor onboarding', 'Accueil des contributeurs'],
        prompt: [
          'How will new contributors get productive?',
          'Comment les nouveaux contributeurs deviendront-ils productifs ?',
        ],
        explain: [
          'Point new people to the specification, setup guide, conventions and a first task. Good onboarding also helps coding agents.',
          'Orientez les nouveaux vers la spécification, le guide d’installation, les conventions et une première tâche. Un bon accueil aide aussi les agents de code.',
        ],
        hint: ['Reading list · setup time target · first task · buddy', 'Lectures · temps d’installation visé · première tâche · parrain'],
        example: [
          'Read .plan/README.md and conventions; run the Docker setup in under 30 minutes; first task tagged “good first issue”.',
          'Lire .plan/README.md et les conventions ; installer avec Docker en moins de 30 minutes ; première tâche étiquetée « good first issue ».',
        ],
      },
      {
        n: 6,
        label: ['Implementation tasks', 'Tâches d’implémentation'],
        prompt: [
          'How is the work broken into implementation tasks?',
          'Comment le travail est-il découpé en tâches d’implémentation ?',
        ],
        explain: [
          'Tasks should reference requirement and test IDs so progress can be traced back to the specification.',
          'Les tâches font référence aux identifiants d’exigences et de tests pour relier l’avancement à la spécification.',
        ],
        hint: ['Task · requirement IDs · test IDs · estimate · order', 'Tâche · ID d’exigences · ID de tests · estimation · ordre'],
        example: [
          'TASK-01 Request submission API (REQ-001, TEST-001); TASK-02 Organization isolation (REQ-002, TEST-003).',
          'TASK-01 API de soumission (REQ-001, TEST-001) ; TASK-02 Isolation des organisations (REQ-002, TEST-003).',
        ],
      },
      {
        n: 7,
        required: true,
        label: ['Coding-agent instructions', 'Instructions aux agents de code'],
        prompt: [
          'What must coding agents always do, and never do, in this project?',
          'Que doivent toujours faire, et ne jamais faire, les agents de code dans ce projet ?',
        ],
        explain: [
          'These instructions are exported to AGENTS.md, CLAUDE.md and Copilot instructions. Be explicit about identifiers, tests, documentation updates and escalation.',
          'Ces instructions sont exportées vers AGENTS.md, CLAUDE.md et les instructions Copilot. Soyez explicite sur les identifiants, les tests, la documentation et la remontée des questions.',
        ],
        hint: ['Always · never · verification commands · escalation', 'Toujours · jamais · commandes de vérification · remontée'],
        example: [
          'Always run pnpm lint and pnpm test; keep REQ/ADR identifiers; update .plan records. Never change an approved baseline or guess an open decision — report it.',
          'Toujours exécuter pnpm lint et pnpm test ; conserver les identifiants REQ/ADR ; mettre à jour .plan. Ne jamais modifier une référence approuvée ni deviner une décision ouverte — la signaler.',
        ],
      },
    ],
  },
];
