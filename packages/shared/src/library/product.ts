import type { ModuleDraft } from '../template-types';

export const productModules: ModuleDraft[] = [
  {
    id: 'discovery',
    title: ['Business & discovery', 'Métier et découverte'],
    description: ['Start with the problem worth solving.', 'Commencez par le problème à résoudre.'],
    guidance: [
      'Describe the situation before the solution. Name real people, current workarounds and the evidence you already have. Mark guesses as unknown so they become explicit follow-up work.',
      'Décrivez la situation avant la solution. Nommez les personnes concernées, les contournements actuels et les preuves disponibles. Marquez les suppositions comme inconnues pour en faire des actions de suivi.',
    ],
    dependsOn: [],
    references: [
      {
        title: 'ISO/IEC/IEEE 29148 — Requirements engineering',
        url: 'https://www.iso.org/standard/72089.html',
      },
      { title: 'Impact Mapping', url: 'https://www.impactmapping.org/' },
    ],
    diagrams: [
      {
        id: 'discovery-map',
        title: ['Discovery map', 'Carte de découverte'],
        code: 'mindmap\n  root((Product idea))\n    Problem\n      Who is affected\n      Current workaround\n    Goals\n      Outcome metric\n    Stakeholders\n      Sponsor\n      Users\n    Risks\n      Adoption\n      Budget',
      },
      {
        id: 'stakeholder-grid',
        title: ['Stakeholder influence grid', 'Grille d’influence des parties prenantes'],
        code: 'quadrantChart\n  title Stakeholder influence\n  x-axis Low interest --> High interest\n  y-axis Low influence --> High influence\n  quadrant-1 Manage closely\n  quadrant-2 Keep satisfied\n  quadrant-3 Monitor\n  quadrant-4 Keep informed\n  Sponsor: [0.8, 0.9]\n  End users: [0.9, 0.3]\n  Security team: [0.4, 0.7]',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        label: ['Problem to solve', 'Problème à résoudre'],
        prompt: [
          'What problem are you solving, and for whom?',
          'Quel problème résolvez-vous, et pour qui ?',
        ],
        explain: [
          'A clear problem statement keeps every later decision honest. Describe what happens today, who is affected, and what it costs them.',
          'Un énoncé clair du problème guide toutes les décisions suivantes. Décrivez la situation actuelle, les personnes touchées et ce que cela leur coûte.',
        ],
        hint: [
          'Current situation · affected people · frequency · cost of inaction · evidence',
          'Situation actuelle · personnes touchées · fréquence · coût de l’inaction · preuves',
        ],
        example: [
          'Customers track service requests across email threads. Support spends about 6 hours a week answering “what is the status?” messages.',
          'Les clients suivent leurs demandes dans des fils de courriels. Le support consacre environ 6 heures par semaine à répondre aux questions de suivi.',
        ],
      },
      {
        n: 2,
        required: true,
        label: ['Business goals', 'Objectifs métier'],
        prompt: [
          'What outcomes should this project achieve?',
          'Quels résultats ce projet doit-il atteindre ?',
        ],
        explain: [
          'Goals describe the change you want in the world, not features. Good goals can be checked after launch.',
          'Les objectifs décrivent le changement attendu, pas des fonctionnalités. Un bon objectif peut être vérifié après le lancement.',
        ],
        hint: [
          'Outcome · baseline · target · deadline · owner',
          'Résultat · niveau actuel · cible · échéance · responsable',
        ],
        example: [
          'Reduce status follow-up emails by 30% within one quarter of launch.',
          'Réduire de 30 % les courriels de suivi dans le trimestre suivant le lancement.',
        ],
      },
      {
        n: 3,
        required: true,
        kind: 'table',
        label: ['Stakeholders and owners', 'Parties prenantes et responsables'],
        prompt: [
          'Who has a stake in this project, and who decides?',
          'Qui est concerné par ce projet, et qui décide ?',
        ],
        explain: [
          'List the people and teams who fund, use, operate, secure or approve the system. Naming decision owners early prevents stalled reviews.',
          'Listez les personnes et équipes qui financent, utilisent, exploitent, sécurisent ou approuvent le système. Nommer tôt les décideurs évite les revues bloquées.',
        ],
        hint: [
          'Sponsor · product owner · technical owner · operators · reviewers · decision rights',
          'Commanditaire · responsable produit · responsable technique · exploitation · réviseurs · droits de décision',
        ],
        example: [
          'Customer Experience (product owner, approves scope); Platform Engineering (technical owner); Security (reviews threat model).',
          'Expérience client (responsable produit, approuve le périmètre) ; Ingénierie plateforme (responsable technique) ; Sécurité (revoit le modèle de menaces).',
        ],
        columns: [
          ['Stakeholder', 'Partie prenante'],
          ['Interest', 'Intérêt'],
          ['Decision rights', 'Droits de décision'],
        ],
      },
      {
        n: 4,
        required: true,
        label: ['Target users and personas', 'Utilisateurs et personas'],
        prompt: ['Who will use the system?', 'Qui utilisera le système ?'],
        explain: [
          'Personas are short, evidence-based descriptions of user groups: their goals, context and constraints. Two or three are usually enough.',
          'Les personas décrivent brièvement des groupes d’utilisateurs à partir de faits : objectifs, contexte et contraintes. Deux ou trois suffisent généralement.',
        ],
        hint: [
          'Primary and secondary users · goals · context · skills · accessibility needs',
          'Utilisateurs principaux et secondaires · objectifs · contexte · compétences · accessibilité',
        ],
        example: [
          'Primary: office managers at client companies, using a laptop a few times a week. Secondary: support agents working full days in the tool.',
          'Principal : responsables administratifs chez les clients, sur ordinateur quelques fois par semaine. Secondaire : agents de support utilisant l’outil toute la journée.',
        ],
      },
      {
        n: 5,
        required: true,
        label: ['Expected users and concurrent users', 'Utilisateurs prévus et simultanés'],
        prompt: ['How many people will use it, and how many at once?', 'Combien de personnes l’utiliseront, et combien simultanément ?'],
        explain: [
          'User counts drive capacity, cost and architecture. Give an estimate for launch and for one year later, and say how confident you are.',
          'Le nombre d’utilisateurs détermine la capacité, les coûts et l’architecture. Estimez-le au lancement et un an plus tard, en précisant votre niveau de confiance.',
        ],
        hint: [
          'Registered · daily active · peak concurrent · growth · source of estimate',
          'Inscrits · actifs par jour · pic simultané · croissance · source de l’estimation',
        ],
        example: [
          'Launch: 2,000 registered, 200 daily, 50 concurrent. Year one: 10,000 registered, 250 concurrent. Based on the current CRM account list.',
          'Lancement : 2 000 inscrits, 200 par jour, 50 simultanés. Première année : 10 000 inscrits, 250 simultanés. Estimation basée sur la liste de comptes du CRM.',
        ],
      },
      {
        n: 6,
        label: ['Business model and budget', 'Modèle économique et budget'],
        prompt: [
          'How is the project funded, and what budget limits apply?',
          'Comment le projet est-il financé, et quelles limites budgétaires s’appliquent ?',
        ],
        explain: [
          'Budget shapes technology and hosting choices. Include build cost, running cost and who pays. Internal tools can describe the cost centre instead of revenue.',
          'Le budget oriente les choix techniques et d’hébergement. Indiquez le coût de réalisation, le coût d’exploitation et le payeur. Un outil interne peut décrire son centre de coûts.',
        ],
        hint: [
          'Revenue or cost centre · build budget · monthly run budget · AI/provider spend · approval threshold',
          'Revenus ou centre de coûts · budget de réalisation · budget mensuel · dépenses IA · seuil d’approbation',
        ],
        example: [
          'Internal cost centre. Build: 3 engineers for 4 months. Hosting below $600/month; AI usage capped at $150/month.',
          'Centre de coûts interne. Réalisation : 3 ingénieurs pendant 4 mois. Hébergement sous 600 $/mois ; IA plafonnée à 150 $/mois.',
        ],
      },
      {
        n: 7,
        label: ['Constraints and assumptions', 'Contraintes et hypothèses'],
        prompt: [
          'What constraints are fixed, and what are you assuming?',
          'Quelles contraintes sont imposées, et que supposez-vous ?',
        ],
        explain: [
          'Constraints are non-negotiable (deadlines, regulations, mandated platforms). Assumptions are beliefs that could be wrong; list how you will check them.',
          'Les contraintes sont non négociables (échéances, réglementation, plateformes imposées). Les hypothèses peuvent être fausses : indiquez comment les vérifier.',
        ],
        hint: [
          'Deadlines · mandated technology · regulation · team skills · assumptions with validation step',
          'Échéances · technologies imposées · réglementation · compétences · hypothèses et vérification',
        ],
        example: [
          'Must run on the company Kubernetes platform. Assumption: customers accept email notifications — validate with 5 interviews.',
          'Doit fonctionner sur la plateforme Kubernetes de l’entreprise. Hypothèse : les clients acceptent les notifications par courriel — à valider par 5 entretiens.',
        ],
      },
      {
        n: 8,
        required: true,
        label: ['Success metrics', 'Indicateurs de réussite'],
        prompt: [
          'How will you know the project succeeded?',
          'Comment saurez-vous que le projet a réussi ?',
        ],
        explain: [
          'Metrics turn goals into evidence. Each metric needs a baseline, a target and a way to measure it.',
          'Les indicateurs transforment les objectifs en preuves. Chaque indicateur a un niveau de départ, une cible et une méthode de mesure.',
        ],
        hint: [
          'Metric · baseline · target · data source · review date',
          'Indicateur · niveau de départ · cible · source de données · date de revue',
        ],
        example: [
          'Status emails per week: 120 → 84 by end of Q2, measured from the support mailbox tags.',
          'Courriels de suivi par semaine : 120 → 84 d’ici la fin du T2, mesuré avec les étiquettes de la boîte du support.',
        ],
      },
      {
        n: 9,
        kind: 'table',
        label: ['Business risks', 'Risques métier'],
        prompt: [
          'What could stop this project from delivering value?',
          'Qu’est-ce qui pourrait empêcher ce projet d’apporter de la valeur ?',
        ],
        explain: [
          'Risks are uncertain events with consequences. Record how likely they are, their impact and who watches them. Link important risks to mitigations later.',
          'Un risque est un événement incertain avec des conséquences. Indiquez sa probabilité, son impact et son responsable. Reliez ensuite les risques importants aux mesures d’atténuation.',
        ],
        hint: [
          'Risk · likelihood · impact · mitigation · owner',
          'Risque · probabilité · impact · atténuation · responsable',
        ],
        example: [
          'Low adoption by customers | Medium | High | Pilot with 3 accounts before launch | Product owner',
          'Faible adoption par les clients | Moyenne | Élevé | Pilote avec 3 comptes avant le lancement | Responsable produit',
        ],
        columns: [
          ['Risk', 'Risque'],
          ['Likelihood', 'Probabilité'],
          ['Impact', 'Impact'],
          ['Mitigation', 'Atténuation'],
          ['Owner', 'Responsable'],
        ],
      },
    ],
  },
  {
    id: 'scope',
    title: ['Scope & requirements', 'Périmètre et exigences'],
    description: ['Define what success includes.', 'Définissez les critères de réussite.'],
    guidance: [
      'Write requirements as observable behaviour with a stable identifier. Every important requirement needs acceptance criteria that a test can check. Say what is excluded as clearly as what is included.',
      'Rédigez les exigences comme des comportements observables avec un identifiant stable. Chaque exigence importante a des critères d’acceptation vérifiables par un test. Précisez les exclusions aussi clairement que le périmètre.',
    ],
    dependsOn: ['discovery'],
    references: [
      {
        title: 'ISO/IEC/IEEE 29148 — Requirements engineering',
        url: 'https://www.iso.org/standard/72089.html',
      },
      { title: 'INVEST criteria (Agile Alliance)', url: 'https://www.agilealliance.org/glossary/invest/' },
      { title: 'Gherkin reference', url: 'https://cucumber.io/docs/gherkin/reference/' },
    ],
    diagrams: [
      {
        id: 'scope-boundary',
        title: ['Scope boundary', 'Frontière du périmètre'],
        code: 'flowchart LR\n  subgraph included[In scope]\n    submit[Submit request] --> track[Track status]\n  end\n  subgraph excluded[Out of scope]\n    billing[Billing changes]\n  end',
      },
      {
        id: 'requirement-diagram',
        title: ['Requirement traceability', 'Traçabilité des exigences'],
        code: 'requirementDiagram\n  requirement submit_request {\n    id: 1\n    text: Customers can submit a request\n    risk: medium\n    verifymethod: test\n  }\n  element portal {\n    type: system\n  }\n  portal - satisfies -> submit_request',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        label: ['In scope', 'Dans le périmètre'],
        prompt: ['What will the first release include?', 'Que comprendra la première version ?'],
        explain: [
          'List the capabilities the first release must deliver. Keep it short: a focused scope ships sooner and is easier to test.',
          'Listez les capacités que la première version doit fournir. Restez concis : un périmètre ciblé se livre plus vite et se teste plus facilement.',
        ],
        hint: [
          'Capabilities · user groups served · channels · release boundary',
          'Capacités · utilisateurs servis · canaux · limite de la version',
        ],
        example: [
          'Sign-in, request creation with attachments, request timeline and support replies.',
          'Connexion, création de demandes avec pièces jointes, historique des demandes et réponses du support.',
        ],
      },
      {
        n: 2,
        required: true,
        label: ['Out of scope', 'Hors périmètre'],
        prompt: ['What is explicitly excluded?', 'Qu’est-ce qui est explicitement exclu ?'],
        explain: [
          'Exclusions prevent silent scope growth. Mention tempting features you have decided not to build now, and why.',
          'Les exclusions évitent l’élargissement discret du périmètre. Mentionnez les fonctionnalités tentantes que vous ne réaliserez pas maintenant, et pourquoi.',
        ],
        hint: ['Excluded features · deferred items · reason', 'Fonctionnalités exclues · reports · raison'],
        example: [
          'Billing changes and live chat are excluded; native mobile apps are deferred to a later release.',
          'Les changements de facturation et le clavardage sont exclus ; les applications mobiles natives sont reportées.',
        ],
      },
      {
        n: 3,
        required: true,
        kind: 'requirements',
        label: ['Functional requirements and priorities', 'Exigences fonctionnelles et priorités'],
        prompt: [
          'Which behaviours must the system provide, and how important is each?',
          'Quels comportements le système doit-il offrir, et quelle est leur importance ?',
        ],
        explain: [
          'Give each requirement a stable ID (REQ-001), one observable behaviour and a priority (Must, Should, Could, Won’t). You can turn rows into traceable items.',
          'Donnez à chaque exigence un identifiant stable (REQ-001), un comportement observable et une priorité (Doit, Devrait, Pourrait, Pas maintenant). Les lignes peuvent devenir des éléments traçables.',
        ],
        hint: [
          'Stable ID · single behaviour · priority · acceptance criteria · source',
          'ID stable · un seul comportement · priorité · critères d’acceptation · source',
        ],
        example: [
          'REQ-001 | Customers can submit a request with up to 5 attachments | Must | Request receives an ID within 2 seconds',
          'REQ-001 | Les clients soumettent une demande avec 5 pièces jointes au plus | Doit | La demande reçoit un ID en moins de 2 secondes',
        ],
        options: [
          ['Must', 'Doit'],
          ['Should', 'Devrait'],
          ['Could', 'Pourrait'],
          ['Won’t', 'Pas maintenant'],
        ],
      },
      {
        n: 4,
        required: true,
        label: ['Acceptance criteria', 'Critères d’acceptation'],
        prompt: [
          'How will each requirement be accepted?',
          'Comment chaque exigence sera-t-elle acceptée ?',
        ],
        explain: [
          'Acceptance criteria describe the checks that prove a requirement works. The Given / When / Then format keeps them precise and testable.',
          'Les critères d’acceptation décrivent les vérifications qui prouvent qu’une exigence fonctionne. Le format Étant donné / Quand / Alors les rend précis et testables.',
        ],
        hint: [
          'Given/When/Then · measurable thresholds · negative cases · linked test',
          'Étant donné/Quand/Alors · seuils mesurables · cas négatifs · test associé',
        ],
        example: [
          'Given a signed-in customer, when they submit a valid request, then it appears in their timeline within 2 seconds.',
          'Étant donné un client connecté, quand il soumet une demande valide, alors elle apparaît dans son historique en moins de 2 secondes.',
        ],
      },
      {
        n: 5,
        label: ['Dependencies', 'Dépendances'],
        prompt: [
          'What does this project depend on?',
          'De quoi ce projet dépend-il ?',
        ],
        explain: [
          'Dependencies are teams, systems, contracts or decisions outside your control. Knowing them early lets you plan around delays.',
          'Les dépendances sont des équipes, systèmes, contrats ou décisions hors de votre contrôle. Les connaître tôt permet d’anticiper les retards.',
        ],
        hint: [
          'External systems · teams · vendor contracts · needed-by date · owner',
          'Systèmes externes · équipes · contrats fournisseurs · date requise · responsable',
        ],
        example: [
          'Identity team must register the OIDC client before the test environment is ready (needed by week 3).',
          'L’équipe identité doit enregistrer le client OIDC avant la préparation de l’environnement de test (semaine 3).',
        ],
      },
      {
        n: 6,
        label: ['Assumptions to validate', 'Hypothèses à valider'],
        prompt: [
          'Which scope assumptions still need validation?',
          'Quelles hypothèses de périmètre restent à valider ?',
        ],
        explain: [
          'Write down what you believe but have not confirmed, and how you will confirm it. Unconfirmed assumptions are a common source of rework.',
          'Notez ce que vous croyez sans l’avoir confirmé, et comment le confirmer. Les hypothèses non vérifiées causent souvent des reprises.',
        ],
        hint: ['Assumption · validation method · date · owner', 'Hypothèse · méthode de validation · date · responsable'],
        example: [
          'Attachments rarely exceed 10 MB — confirm from last quarter’s support mailbox.',
          'Les pièces jointes dépassent rarement 10 Mo — à confirmer avec la boîte du support du dernier trimestre.',
        ],
      },
      {
        n: 7,
        label: ['Release milestones', 'Jalons de livraison'],
        prompt: ['What are the key release milestones?', 'Quels sont les principaux jalons de livraison ?'],
        explain: [
          'Milestones break delivery into checkpoints with clear exit criteria, such as a pilot, a beta or a general release.',
          'Les jalons découpent la livraison en étapes avec des critères de sortie clairs : pilote, bêta ou version générale.',
        ],
        hint: ['Milestone · date · exit criteria · audience', 'Jalon · date · critères de sortie · public'],
        example: [
          'Pilot with 3 customers (June 15, all Must requirements pass); general availability (August 1).',
          'Pilote avec 3 clients (15 juin, toutes les exigences « Doit » validées) ; disponibilité générale (1er août).',
        ],
      },
    ],
  },
  {
    id: 'workflows',
    title: ['Users & workflows', 'Utilisateurs et processus'],
    description: ['Follow the journey, including its exceptions.', 'Décrivez le parcours et ses exceptions.'],
    guidance: [
      'Walk through real tasks step by step, then ask what goes wrong at each step. Exception paths and state changes are where most defects hide.',
      'Parcourez les tâches réelles étape par étape, puis demandez-vous ce qui peut échouer à chaque étape. Les cas d’exception et changements d’état cachent la plupart des défauts.',
    ],
    dependsOn: ['scope'],
    references: [
      { title: 'Mermaid state diagrams', url: 'https://mermaid.js.org/syntax/stateDiagram.html' },
      { title: 'OMG UML specification', url: 'https://www.omg.org/spec/UML/' },
      { title: 'OMG BPMN specification', url: 'https://www.omg.org/spec/BPMN/' },
    ],
    diagrams: [
      {
        id: 'activity',
        title: ['Activity with exception path', 'Activité avec cas d’exception'],
        code: 'flowchart TD\n  start([Customer starts]) --> fill[Complete request form]\n  fill --> valid{Valid?}\n  valid -- yes --> submit[Submit request]\n  valid -- no --> fix[Show field errors]\n  fix --> fill\n  submit --> done([Request tracked])',
      },
      {
        id: 'states',
        title: ['State transitions', 'Transitions d’état'],
        code: 'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Submitted: submit\n  Submitted --> InProgress: assign\n  Submitted --> Rejected: reject\n  InProgress --> Resolved: resolve\n  Resolved --> [*]\n  Rejected --> [*]',
      },
      {
        id: 'use-case-sequence',
        title: ['Use case sequence', 'Séquence d’un cas d’utilisation'],
        code: 'sequenceDiagram\n  actor Customer\n  participant UI as Web app\n  participant API\n  Customer->>UI: Submit request\n  UI->>API: POST /requests\n  API-->>UI: 201 Created (REQ id)\n  UI-->>Customer: Show confirmation',
      },
    ],
    questions: [
      {
        n: 1,
        required: true,
        kind: 'table',
        label: ['Actors and permissions', 'Acteurs et permissions'],
        prompt: [
          'Who or what interacts with the system, and what may each do?',
          'Qui interagit avec le système, et que peut faire chacun ?',
        ],
        explain: [
          'Actors include people and other systems. Listing what each actor may do becomes the basis of your permission model.',
          'Les acteurs sont des personnes ou d’autres systèmes. La liste de ce que chacun peut faire fonde votre modèle de permissions.',
        ],
        hint: ['Actor · capabilities · restrictions', 'Acteur · capacités · restrictions'],
        example: [
          'Customer | Create and view own organization’s requests | Cannot see other organizations',
          'Client | Crée et consulte les demandes de son organisation | Ne voit pas les autres organisations',
        ],
        columns: [
          ['Actor', 'Acteur'],
          ['May do', 'Peut faire'],
          ['May not do', 'Ne peut pas faire'],
        ],
      },
      {
        n: 2,
        required: true,
        label: ['Primary user journey', 'Parcours utilisateur principal'],
        prompt: [
          'What is the main journey, step by step?',
          'Quel est le parcours principal, étape par étape ?',
        ],
        explain: [
          'Describe the most important task from the user’s first action to the outcome. Numbered steps make gaps obvious.',
          'Décrivez la tâche la plus importante, de la première action à l’obtention du résultat. Des étapes numérotées révèlent les manques.',
        ],
        hint: ['Trigger · numbered steps · outcome · time expectation', 'Déclencheur · étapes numérotées · résultat · délai attendu'],
        example: [
          '1. Customer signs in. 2. Opens “New request”. 3. Describes the issue and attaches files. 4. Submits. 5. Sees the request ID and status “Submitted”.',
          '1. Le client se connecte. 2. Ouvre « Nouvelle demande ». 3. Décrit le problème et joint des fichiers. 4. Soumet. 5. Voit l’ID et le statut « Soumise ».',
        ],
      },
      {
        n: 3,
        required: true,
        kind: 'table',
        label: ['Use cases and triggers', 'Cas d’utilisation et déclencheurs'],
        prompt: [
          'Which use cases must the system support?',
          'Quels cas d’utilisation le système doit-il prendre en charge ?',
        ],
        explain: [
          'A use case is a goal an actor achieves with the system. Give each one an ID (UC-001) so requirements and tests can refer to it.',
          'Un cas d’utilisation est un objectif qu’un acteur atteint avec le système. Donnez-lui un identifiant (UC-001) pour que les exigences et tests y fassent référence.',
        ],
        hint: ['ID · use case · actor · trigger · outcome', 'ID · cas d’utilisation · acteur · déclencheur · résultat'],
        example: [
          'UC-001 | Submit a request | Customer | New issue | Request tracked with an ID',
          'UC-001 | Soumettre une demande | Client | Nouveau problème | Demande suivie avec un ID',
        ],
        columns: [
          ['ID', 'ID'],
          ['Use case', 'Cas d’utilisation'],
          ['Actor', 'Acteur'],
          ['Trigger', 'Déclencheur'],
          ['Outcome', 'Résultat'],
        ],
      },
      {
        n: 4,
        required: true,
        label: ['Business rules', 'Règles métier'],
        prompt: [
          'Which business rules must always hold?',
          'Quelles règles métier doivent toujours être respectées ?',
        ],
        explain: [
          'Business rules are policies the system enforces regardless of screen or API — limits, eligibility, calculations. Number them so tests can reference them.',
          'Les règles métier sont des politiques appliquées quel que soit l’écran ou l’API : limites, éligibilité, calculs. Numérotez-les pour que les tests y fassent référence.',
        ],
        hint: ['Rule ID · rule · source/authority · enforcement point', 'ID de règle · règle · source · point d’application'],
        example: [
          'BR-01: A closed request can be reopened only within 14 days. Source: support policy v3.',
          'RM-01 : Une demande fermée ne peut être rouverte que dans les 14 jours. Source : politique du support v3.',
        ],
      },
      {
        n: 5,
        required: true,
        label: ['Error and exception paths', 'Erreurs et exceptions'],
        prompt: [
          'What can go wrong, and what should happen then?',
          'Qu’est-ce qui peut mal tourner, et que doit-il se passer alors ?',
        ],
        explain: [
          'For each important step, describe invalid input, missing permissions, unavailable dependencies and timeouts, and how users recover.',
          'Pour chaque étape importante, décrivez les saisies invalides, permissions manquantes, dépendances indisponibles et délais dépassés, et comment l’utilisateur s’en sort.',
        ],
        hint: [
          'Failure · detection · user message · recovery · data consistency',
          'Défaillance · détection · message · reprise · cohérence des données',
        ],
        example: [
          'Attachment upload fails: keep the draft, show which file failed, allow retry; the request is not submitted until all uploads succeed.',
          'Échec d’envoi d’une pièce jointe : conserver le brouillon, indiquer le fichier en cause, permettre de réessayer ; la demande n’est soumise qu’après tous les envois.',
        ],
      },
      {
        n: 6,
        label: ['States and transitions', 'États et transitions'],
        prompt: [
          'Which states do key records move through?',
          'Par quels états passent les principaux enregistrements ?',
        ],
        explain: [
          'State models show which transitions are allowed and who can trigger them. They prevent impossible states such as “resolved but never assigned”.',
          'Les modèles d’état indiquent les transitions permises et qui peut les déclencher. Ils évitent des états impossibles comme « résolue sans jamais être assignée ».',
        ],
        hint: ['States · allowed transitions · actor · guard conditions', 'États · transitions permises · acteur · conditions'],
        example: [
          'Draft → Submitted (customer) → In progress (agent) → Resolved (agent) → Closed after 14 days.',
          'Brouillon → Soumise (client) → En cours (agent) → Résolue (agent) → Fermée après 14 jours.',
        ],
      },
      {
        n: 7,
        label: ['Accessibility needs', 'Besoins d’accessibilité'],
        prompt: [
          'Which accessibility needs must the workflows support?',
          'Quels besoins d’accessibilité les parcours doivent-ils prendre en charge ?',
        ],
        explain: [
          'Consider keyboard-only use, screen readers, low vision, cognitive load and time limits within each journey, not only on individual screens.',
          'Tenez compte de l’usage au clavier, des lecteurs d’écran, de la basse vision, de la charge cognitive et des délais dans chaque parcours, pas seulement écran par écran.',
        ],
        hint: [
          'Assistive technology · keyboard paths · time limits · plain language · standard',
          'Technologies d’assistance · parcours clavier · délais · langage clair · norme',
        ],
        example: [
          'The full request journey works with keyboard and NVDA; no step has a time limit; error messages name the field and fix.',
          'Le parcours complet fonctionne au clavier et avec NVDA ; aucune étape n’a de délai ; les erreurs nomment le champ et la correction.',
        ],
        skip: ['API / service', 'Library / SDK'],
      },
    ],
  },
];
