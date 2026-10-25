export type RecipeCategory =
  | "Cookies"
  | "Simple Cakes & Cupcakes"
  | "Easy Bars"
  | "Pastries"
  | "Cakes & Frostings"
  | "Custards & Creams"
  | "More Advanced Cakes"
  | "Yeast Pastries"
  | "Quick Bakes"
  | "Choux Pastry"
  | "Tarts"
  | "Laminate"
  | "Custom";

export type Ingredient = {
  id: string;
  name: string;
  amount: string;
  note?: string;
  scaleWithBatch?: boolean;
};

export type RecipeStep = {
  id: string;
  title: string;
  detail: string;
  why?: string;
  tip?: string;
};

export type Recipe = {
  id: string;
  category?: RecipeCategory | string | null;
  title: string;
  blurb: string;
  time: string;
  yield: string;
  difficulty: "Novice" | "Intermediate" | "Experienced" | "Challenges";
  ingredients: Ingredient[];
  steps: RecipeStep[];
  equipment?: string[];
  storage?: string;
  notes?: string[];
  reviewNotes?: string[];
  reviewedOn?: string;
  sources?: { title: string; url: string }[];
  sourceRecipeId?: string;
  baseYield?: string;
  batchScale?: number;
  adaptation?: {
    sourceRecipeId: string;
    request: string;
    createdAt: string;
    changes: string[];
    considerations: string[];
    source: "openai" | "local";
    model?: string;
    before?: Omit<Recipe, 'adaptation'>;
  };
};

export type ChefResult = {
  recipe: Recipe;
  summary: string;
  changes: string[];
  considerations: string[];
  questions: string[];
  source: "openai" | "local";
  model?: string;
};

export type ChecklistState = Record<string, boolean>;

export type RecipeProgress = {
  ingredients: ChecklistState;
  steps: ChecklistState;
  /** ISO timestamp for the most recent time this recipe was logged as complete. */
  completedAt?: string;
};

export type ProgressByRecipe = Record<string, RecipeProgress>;
