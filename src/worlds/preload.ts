import { preloadAthlete } from "./presence/assets";
export const loadCourt = () => import("./BasketballCourt").then(module => { module.preloadCourtAssets(); preloadAthlete(); return module; });
// Promise 回调中启动纹理缓存，避免 Loader 在 React 渲染阶段通知已挂载的进度观察者。
export const loadRide = () => import("./road/Experience").then(module => { module.preloadRoadAssets(); preloadAthlete(); return module; });
export const loadAlpine = () => import("./alpine/Experience").then(module => { module.preloadAlpineAssets(); preloadAthlete(); return module; });
export function preloadWorld(id: string) {
  return id === "basketball" ? loadCourt() : id === "cycling" ? loadRide() : id === "alpine-ride" ? loadAlpine() : Promise.resolve();
}
