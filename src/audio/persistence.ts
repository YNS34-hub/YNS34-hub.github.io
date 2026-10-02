export interface SavedPlayerState {
  currentId: string | null;
  progress: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  crossfade: number;
}

/** Persist queue position, never a permission to autoplay. */
export function restorePlayerState(raw: string | null): SavedPlayerState {
  const fallback: SavedPlayerState = {
    currentId: null,
    progress: 0,
    shuffle: false,
    repeat: "off",
    crossfade: 2.5,
  };
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return fallback;
    const value = parsed as Record<string, unknown>;
    return {
      currentId: typeof value.currentId === "string" ? value.currentId : null,
      progress:
        typeof value.progress === "number" && Number.isFinite(value.progress)
          ? Math.max(0, value.progress)
          : 0,
      shuffle: value.shuffle === true,
      repeat:
        value.repeat === "all" || value.repeat === "one" ? value.repeat : "off",
      crossfade:
        typeof value.crossfade === "number" && Number.isFinite(value.crossfade)
          ? Math.max(0, Math.min(8, value.crossfade))
          : 2.5,
    };
  } catch {
    return fallback;
  }
}
