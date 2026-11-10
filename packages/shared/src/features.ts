/** Public claims are deliberately limited to working product capabilities. */
export const features = [
  {id:'interview', en:'An interview that adapts to your project', fr:'Un entretien adapté au projet', detail:'14 documentation modules, structured answers, unknowns and exceptions.', detailFr:'14 modules, réponses structurées, inconnues et exceptions.'},
  {id:'documents', en:'Your architecture, in your own words', fr:'Votre architecture, dans vos mots', detail:'Editable Markdown, diagrams, revision history and conflict review.', detailFr:'Markdown éditable, diagrammes, historique et résolution des conflits.'},
  {id:'catalog', en:'A deliberate technology stack', fr:'Une pile technologique réfléchie', detail:'Versioned technology catalog and stack-specific questions.', detailFr:'Catalogue versionné et questions adaptées à votre pile.'},
  {id:'review', en:'AI proposes. Your team decides.', fr:'L’IA propose. Votre équipe décide.', detail:'Review changes and assumptions before accepting a proposal.', detailFr:'Révisez changements et hypothèses avant d’accepter une proposition.'},
  {id:'handoff', en:'A specification your agents can use', fr:'Une spécification pour vos agents', detail:'Markdown, canonical JSON and ZIP bundles with agent instructions.', detailFr:'Markdown, JSON canonique et ZIP avec consignes pour les agents.'},
  {id:'governance', en:'Evidence before approval', fr:'Des preuves avant approbation', detail:'Requirement-to-test links, readiness checks and immutable baselines.', detailFr:'Liens exigences-tests, préparation et références immuables.'},
] as const;
