import type { TourStep } from './components/Tour';

export function tourSteps(l: (en: string, fr: string) => string): TourStep[] {
  return [
    {
      title: l('Welcome to SDD Studio', 'Bienvenue dans SDD Studio'),
      body: l(
        'This short tour shows where things are. You define a project with a guided interview, review AI suggestions, approve a baseline and hand it to your team and coding agents.',
        'Cette courte visite montre où se trouvent les choses. Vous définissez un projet par un entretien guidé, révisez les suggestions de l’IA, approuvez une référence et la transmettez à votre équipe et à ses agents de code.',
      ),
    },
    {
      target: 'project-picker',
      title: l('Projects', 'Projets'),
      body: l(
        'Switch between projects here, or create one — blank, or from the complete example.',
        'Changez de projet ici, ou créez-en un — vide, ou à partir de l’exemple complet.',
      ),
    },
    {
      target: 'nav-overview',
      title: l('Overview', 'Vue d’ensemble'),
      body: l(
        'See how complete your document is, what to do next, and how it is saved.',
        'Voyez la complétude du document, les prochaines étapes et comment il est enregistré.',
      ),
    },
    {
      target: 'nav-stack',
      title: l('Technology stack', 'Pile technologique'),
      body: l(
        'Before the questions, drag technologies from the catalog into layers. The stack fills answers and adds tailored questions.',
        'Avant les questions, glissez des technologies du catalogue dans les couches. La pile remplit des réponses et ajoute des questions adaptées.',
      ),
    },
    {
      target: 'nav-specification',
      title: l('Guided interview and documents', 'Entretien guidé et documents'),
      body: l(
        'Chat asks one question at a time. Form opens direct editing. The document previews your answers; its Tools button reveals editing and history.',
        'La discussion pose une question à la fois. Formulaire permet la saisie directe. Le document affiche vos réponses ; Outils révèle la modification et l’historique.',
      ),
    },
    {
      target: 'save-status',
      title: l('Automatic saving', 'Enregistrement automatique'),
      body: l(
        'Every change is saved as a new revision. If someone else changed the same thing, you choose which version to keep.',
        'Chaque changement devient une nouvelle révision. Si quelqu’un a modifié la même chose, vous choisissez la version à garder.',
      ),
    },
    {
      target: 'nav-proposals',
      title: l('AI proposals', 'Propositions de l’IA'),
      body: l(
        'AI, Git and imports never change your specification directly. Review each proposal’s changes, sources and assumptions, then accept or reject.',
        'L’IA, Git et les imports ne modifient jamais directement la spécification. Révisez les changements, sources et hypothèses, puis acceptez ou rejetez.',
      ),
    },
    {
      target: 'nav-readiness',
      title: l('Readiness and baselines', 'Préparation et références'),
      body: l(
        'Reviewers approve sections and freeze an immutable baseline when every blocker is resolved.',
        'Les réviseurs approuvent les sections et figent une référence immuable quand tous les blocages sont résolus.',
      ),
    },
    {
      target: 'nav-board',
      title: l('Implementation board', 'Tableau de réalisation'),
      body: l(
        'An approved baseline becomes cards, one per requirement, use case and component. Move them as work progresses, link pull requests, and sync with .plan/tasks.md.',
        'Une référence approuvée devient des cartes, une par exigence, cas d’utilisation et composant. Déplacez-les au fil du travail, liez les demandes de fusion et synchronisez avec .plan/tasks.md.',
      ),
    },
    {
      target: 'nav-publishing',
      title: l('Publish and hand off', 'Publier et transmettre'),
      body: l(
        'Export the whole .plan folder, PRODUCT.md and DESIGN.md, JSON or TOON, publish to a Git branch with a pull request, or connect a coding agent over MCP.',
        'Exportez tout le dossier .plan, PRODUCT.md et DESIGN.md, du JSON ou du TOON, publiez sur une branche Git avec une demande de fusion, ou connectez un agent de code par MCP.',
      ),
    },
    {
      target: 'display',
      title: l('Make it yours', 'Personnalisez'),
      body: l(
        'Choose light or dark, a font and a text size. The sidebar folds into icons on smaller windows. The help button restarts this tour, and the book opens the documentation.',
        'Choisissez clair ou sombre, une police et une taille. La barre latérale se replie en icônes sur les petites fenêtres. L’aide relance cette visite et le livre ouvre la documentation.',
      ),
    },
  ];
}
