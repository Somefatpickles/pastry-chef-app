export const chefPromptSuggestions: readonly string[];
export type ChefPromptSelection = { suggestions: readonly string[]; placeholder: string };
export function chooseChefPrompts(random?: () => number): ChefPromptSelection;
