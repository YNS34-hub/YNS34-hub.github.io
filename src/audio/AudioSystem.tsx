import { useEffect } from "react";
import { initializeAudio } from "./player";
import { initializeSpaceAudio } from "./space";

export function AudioSystem() {
  useEffect(() => {
    initializeAudio();
    return initializeSpaceAudio();
  }, []);
  return null;
}
