export type AppPage = 'recipes' | 'current' | 'profile' | 'analytics';
export const pageOrder: readonly AppPage[];
export const pageLabels: Readonly<Record<AppPage, string>>;
export function normalizePage(value: unknown): AppPage;
export function pageFromHash(hash: unknown): AppPage;
export function pageHash(page: unknown): string;
export function pageOffset(page: unknown, activePage: unknown): number;
export function slideOffset(page: unknown, activePage: unknown): number;
export function transitionDirection(previousPage: unknown, nextPage: unknown): 'forward' | 'backward' | 'none';
