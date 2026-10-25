import { useGLTF } from "@react-three/drei";
export const ATHLETE = "/media/presence/athlete.gltf";
export const ATHLETE_DETAIL = "/media/presence/athlete-detail.gltf";
export const preloadAthlete = () => {useGLTF.preload(ATHLETE);useGLTF.preload(ATHLETE_DETAIL);};
