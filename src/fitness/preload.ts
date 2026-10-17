export const loadGymRoom=()=>import('../rooms/PrivateGym').then(module=>{module.preloadGymAssets();return module;});
