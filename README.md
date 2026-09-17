# Pastry Chef App

A Vite + React + TypeScript pastry recipe selector with cloud-synced completion tracking.

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Structure

The app starts on a centered `Start Baking!` screen, then opens a recipe workspace with:

- a recipe list for selecting pastries
- ingredient checklists
- step-by-step baking guidance
- summary progress for the currently selected recipe
- completed-recipe logging, persisted in Firebase for the signed-in baker

Replace the sample recipe data in `src/recipeLibrary.ts` with the specific recipe categories you want to add next.

## Firebase setup

Completion history is synced to the same signed-in baker on every device. Before running the app, create a Firebase project, register a Web app, and then:

1. In **Authentication**, enable the **Email/Password** sign-in provider.
2. In **Firestore Database**, create a database.
3. Copy `.env.example` to `.env` and fill in the Firebase Web app configuration values.
4. Deploy Firestore rules that only permit each signed-in user to read and write their own profile:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bakingProfiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

The app stores progress and the most recent completion timestamp at `bakingProfiles/{userId}`. Firebase's browser configuration values are safe to expose; the Firestore rules above protect the data.
