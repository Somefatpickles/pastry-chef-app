import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { firestore } from "./firebase";
import type { ProgressByRecipe } from "./types";

const profileDocument = (userId: string) => {
  if (!firestore) {
    throw new Error("Firebase is not configured.");
  }

  return doc(firestore, "bakingProfiles", userId);
};

export function subscribeToProgress(
  userId: string,
  onChange: (progress: ProgressByRecipe | null) => void,
  onError: () => void,
) {
  return onSnapshot(
    profileDocument(userId),
    (snapshot) => {
      const data = snapshot.data();
      onChange((data?.progressByRecipe as ProgressByRecipe | undefined) ?? null);
    },
    onError,
  );
}

export function saveProgress(userId: string, progressByRecipe: ProgressByRecipe) {
  return setDoc(
    profileDocument(userId),
    {
      progressByRecipe,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
