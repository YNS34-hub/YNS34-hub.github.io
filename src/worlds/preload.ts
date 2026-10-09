export const loadCourt = () => import("./BasketballCourt");
// Promise 回调中启动纹理缓存，避免 Loader 在 React 渲染阶段通知已挂载的进度观察者。
export const loadRide = () => import("./road/Experience").then(module => { module.preloadRoadAssets(); return module; });
export function preloadWorld(id: string) {
  return id === "basketball" ? loadCourt() : id === "cycling" ? loadRide() : Promise.resolve();
}
