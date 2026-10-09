export const loadCourt = () => import("./BasketballCourt");
export const loadRide = () => import("./ScenicCycling");
export function preloadWorld(id: string) {
  return id === "basketball" ? loadCourt() : id === "cycling" ? loadRide() : Promise.resolve();
}
