import { useEffect, useMemo, useState } from "react";

import { recipes } from "./recipeLibrary";
import type { Recipe } from "./types";

type ChecklistState = Record<string, boolean>;

type RecipeProgress = {
  ingredients: ChecklistState;
  steps: ChecklistState;
};

function createChecklist(items: { id: string }[]): ChecklistState {
  return items.reduce<ChecklistState>((accumulator, item) => {
    accumulator[item.id] = false;
    return accumulator;
  }, {});
}

function createProgress(recipe: Recipe): RecipeProgress {
  return {
    ingredients: createChecklist(recipe.ingredients),
    steps: createChecklist(recipe.steps),
  };
}

function recipeCompletionCount(progress: RecipeProgress, recipe: Recipe): string {
  const ingredientTotal = recipe.ingredients.length;
  const stepTotal = recipe.steps.length;
  const ingredientDone = recipe.ingredients.filter((ingredient) => progress.ingredients[ingredient.id]).length;
  const stepDone = recipe.steps.filter((step) => progress.steps[step.id]).length;

  return `${ingredientDone}/${ingredientTotal} ingredients · ${stepDone}/${stepTotal} steps`;
}

export default function App() {
  const [started, setStarted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Recipe["difficulty"] | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [progressByRecipe, setProgressByRecipe] = useState<Record<string, RecipeProgress>>(() =>
    recipes.reduce<Record<string, RecipeProgress>>((accumulator, recipe) => {
      accumulator[recipe.id] = createProgress(recipe);
      return accumulator;
    }, {}),
  );

  const difficulties = useMemo<Recipe["difficulty"][]>(() => ["Novice", "Intermediate", "Experienced", "Challenges"], []);

  const categorySelectionRequired = selectedDifficulty !== null && selectedDifficulty !== "Challenges";

  const categories = useMemo(
    () =>
      selectedDifficulty && selectedDifficulty !== "Challenges"
        ? [
            ...new Set(
              recipes
                .filter((recipe) => recipe.difficulty === selectedDifficulty)
                .map((recipe) => recipe.category)
                .filter((category): category is string => Boolean(category)),
            ),
          ]
        : [],
    [selectedDifficulty],
  );

  const visibleRecipes = useMemo(
    () =>
      selectedDifficulty === "Challenges"
        ? recipes.filter((recipe) => recipe.difficulty === "Challenges")
        : selectedDifficulty && selectedCategory
        ? recipes.filter(
            (recipe) =>
              recipe.difficulty === selectedDifficulty && recipe.category === selectedCategory,
          )
        : [],
    [selectedCategory, selectedDifficulty],
  );

  useEffect(() => {
    if ((!selectedDifficulty || selectedDifficulty === "Challenges") && selectedCategory !== null) {
      setSelectedCategory(null);
    }
  }, [selectedCategory, selectedDifficulty]);

  useEffect(() => {
    if (!selectedRecipeId) {
      return;
    }

    if (!visibleRecipes.some((recipe) => recipe.id === selectedRecipeId)) {
      setSelectedRecipeId(null);
    }
  }, [selectedRecipeId, visibleRecipes]);

  const selectedRecipe = visibleRecipes.find((recipe) => recipe.id === selectedRecipeId) ?? null;
  const selectedProgress = selectedRecipe ? progressByRecipe[selectedRecipe.id] : undefined;

  if (!started) {
    return (
      <main className="app-shell intro-shell">
        <section className="intro-card">
          <p className="eyebrow">PASTRY CHEF WORKBENCH</p>
          <h1>Recipe selection starts here.</h1>
          <p className="lede">
            Open the kitchen, choose a pastry recipe, and follow a guided checklist for ingredients and steps. This
            foundation is ready for the specific recipe categories you will provide next.
          </p>
          <button className="start-button" onClick={() => setStarted(true)} type="button">
            Start Baking!
          </button>
          <p className="intro-note">Built as a Vite + React + TypeScript scaffold for easy recipe expansion.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell kitchen-shell">
      <section className="kitchen-frame">
        <header className="top-banner">
          <div>
            <p className="eyebrow">PASTRY CHEF WORKBENCH</p>
            <h1>Recipe deck and baking guide</h1>
            <p className="lede compact-lede">
              Pick a pastry, check off ingredients, and work through the steps one by one. Swap the sample cards with
              your own categories when you are ready.
            </p>
          </div>

          <div className="banner-stats">
            <div>
              <span>Recipes</span>
              <strong>{recipes.length}</strong>
            </div>
            <div>
              <span>Category</span>
              <strong>
                {selectedDifficulty === "Challenges"
                  ? "Not required"
                  : selectedCategory ?? "Select one"}
              </strong>
            </div>
            <div>
              <span>Progress</span>
              <strong>{selectedRecipe ? recipeCompletionCount(selectedProgress ?? createProgress(selectedRecipe), selectedRecipe) : "Select a recipe"}</strong>
            </div>
          </div>
        </header>

        <div className="workspace-grid">
          <aside className="panel recipe-rail">
            <div className="section-head">
              <div>
                <p className="eyebrow">RECIPE LIBRARY</p>
                <h2>Select a pastry</h2>
              </div>
              <p className="section-help">Start with a skill level, then choose a pastry category when one is required.</p>
            </div>

            <div className="section-head compact-head">
              <div>
                <p className="eyebrow">DIFFICULTY FILTER</p>
                <h3>Choose a skill level</h3>
              </div>
            </div>

            <div className="category-strip">
              {difficulties.map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  className={`category-chip ${difficulty === selectedDifficulty ? "active" : ""}`}
                  onClick={() => {
                    setSelectedDifficulty(difficulty);
                    setSelectedCategory(null);
                    setSelectedRecipeId(null);
                  }}
                >
                  {difficulty}
                </button>
              ))}
            </div>

            <div className="section-head compact-head">
              <div>
                <p className="eyebrow">CATEGORY FILTER</p>
                <h3>Choose a pastry category</h3>
              </div>
            </div>

            <div className="category-strip">
              {selectedDifficulty === "Challenges" ? (
                <div className="filter-prompt">
                  Challenge recipes do not use pastry categories. Choose a recipe directly below.
                </div>
              ) : categories.length ? (
                categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`category-chip ${category === selectedCategory ? "active" : ""}`}
                    onClick={() => {
                      setSelectedCategory(category);
                      setSelectedRecipeId(null);
                    }}
                  >
                    {category}
                  </button>
                ))
              ) : (
                <div className="filter-prompt">
                  Choose a difficulty first to unlock the available pastry categories.
                </div>
              )}
            </div>

            <div className="recipe-list">
              {!selectedDifficulty ? (
                <div className="filter-prompt">Choose your skill level to begin browsing recipes.</div>
              ) : categorySelectionRequired && !selectedCategory ? (
                <div className="filter-prompt">Choose a pastry category to reveal matching recipes.</div>
              ) : (
                visibleRecipes.map((recipe) => {
                  const isActive = recipe.id === selectedRecipe?.id;
                  const progress = progressByRecipe[recipe.id];

                  return (
                    <button
                      key={recipe.id}
                      type="button"
                      className={`recipe-card ${isActive ? "active" : ""}`}
                      onClick={() => setSelectedRecipeId(recipe.id)}
                    >
                      <div className="recipe-card-top">
                        {recipe.category ? <span className="recipe-category">{recipe.category}</span> : null}
                        <span className="recipe-meta">{recipe.difficulty}</span>
                      </div>
                      <strong>{recipe.title}</strong>
                      <p>{recipe.blurb}</p>
                      <div className="recipe-card-footer">
                        <span>{recipe.time}</span>
                        <span>{recipe.yield}</span>
                        <span>
                          {recipeCompletionCount(progress ?? createProgress(recipe), recipe)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="panel recipe-workspace">
            {selectedRecipe ? (
              <>
                <header className="recipe-header">
                  <div>
                    <p className="eyebrow">SELECTED RECIPE</p>
                    <h2>{selectedRecipe.title}</h2>
                    <p className="section-help">{selectedRecipe.blurb}</p>
                  </div>
                  <div className="recipe-badges">
                    {selectedRecipe.category ? <span>{selectedRecipe.category}</span> : null}
                    <span>{selectedRecipe.difficulty}</span>
                    <span>{selectedRecipe.time}</span>
                    <span>{selectedRecipe.yield}</span>
                  </div>
                </header>

                <div className="content-grid">
                  <section className="subpanel">
                    <div className="section-head slim">
                      <div>
                        <p className="eyebrow">INGREDIENT CHECKLIST</p>
                        <h3>Gather the pantry items</h3>
                      </div>
                    </div>

                    <div className="checklist">
                      {selectedRecipe.ingredients.map((ingredient) => {
                        const checked = selectedProgress?.ingredients[ingredient.id] ?? false;

                        return (
                          <label key={ingredient.id} className={`check-item ${checked ? "checked" : ""}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setProgressByRecipe((current) => ({
                                  ...current,
                                  [selectedRecipe.id]: {
                                    ...current[selectedRecipe.id],
                                    ingredients: {
                                      ...current[selectedRecipe.id].ingredients,
                                      [ingredient.id]: !current[selectedRecipe.id].ingredients[ingredient.id],
                                    },
                                  },
                                }))
                              }
                            />
                            <span>
                              <strong>{ingredient.name}</strong>
                              <small>
                                {ingredient.amount}
                                {ingredient.note ? ` • ${ingredient.note}` : ""}
                              </small>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>

                  <section className="subpanel">
                    <div className="section-head slim">
                      <div>
                        <p className="eyebrow">STEP-BY-STEP GUIDANCE</p>
                        <h3>Follow the method</h3>
                      </div>
                    </div>

                    <div className="steps-list">
                      {selectedRecipe.steps.map((step, index) => {
                        const checked = selectedProgress?.steps[step.id] ?? false;

                        return (
                          <article key={step.id} className={`step-card ${checked ? "done" : ""}`}>
                            <label>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setProgressByRecipe((current) => ({
                                    ...current,
                                    [selectedRecipe.id]: {
                                      ...current[selectedRecipe.id],
                                      steps: {
                                        ...current[selectedRecipe.id].steps,
                                        [step.id]: !current[selectedRecipe.id].steps[step.id],
                                      },
                                    },
                                  }))
                                }
                              />
                              <span className="step-index">{index + 1}</span>
                              <div>
                                <strong>{step.title}</strong>
                                <p>{step.detail}</p>
                                {step.why ? <p className="step-why">Why: {step.why}</p> : null}
                                {step.tip ? <small>{step.tip}</small> : null}
                              </div>
                            </label>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <h2>
                  {!selectedDifficulty
                    ? "Select a skill level"
                    : categorySelectionRequired && !selectedCategory
                      ? "Select a pastry category"
                      : "Select a recipe"}
                </h2>
                <p>
                  {!selectedDifficulty
                    ? "Begin by choosing your desired skill level from the left-hand filters."
                    : categorySelectionRequired && !selectedCategory
                      ? "Next, choose the pastry category you want to explore for that skill level."
                      : "Choose a pastry from the recipe list to view ingredients and step-by-step guidance."}
                </p>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
