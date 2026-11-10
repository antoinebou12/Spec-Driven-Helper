/** Route pre-handler that authenticates the request. Kept apart from `app.ts` so feature modules do not import it back. */
export type Auth = (req: any) => Promise<void>;
