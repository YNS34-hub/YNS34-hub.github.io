import { create } from "zustand";

// Ephemeral contrast state; no collection or visit data is involved.
export const useIdentityTone = create(() => ({ light: true }));
