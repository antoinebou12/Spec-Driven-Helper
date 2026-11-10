/** What `POST /projects/:id/draft` answers: queued, or the reason there is no draft. */
export type Draft = { queued: true; questions: number } | { queued: false; reason: string };

/** The one line that tells a person what became of the draft they asked for. */
export function draftNotice(draft: Draft, l: (en: string, fr: string) => string) {
  return draft.queued
    ? l(
        `The AI is drafting the ${draft.questions} essential answers. They arrive as a proposal to review.`,
        `L’IA rédige les ${draft.questions} réponses essentielles. Elles arrivent sous forme de proposition à réviser.`,
      )
    : l(`No draft: ${draft.reason}`, `Pas de brouillon : ${draft.reason}`);
}
