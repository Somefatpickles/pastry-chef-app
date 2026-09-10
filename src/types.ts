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
};
