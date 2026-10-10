import { useGLTF } from "@react-three/drei";
export const ATHLETE = "/media/presence/athlete.gltf";
export const preloadAthlete = () => useGLTF.preload(ATHLETE);
