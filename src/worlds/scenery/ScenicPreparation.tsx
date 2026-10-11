import {useEffect,useState,type ReactNode} from "react";
import {useLoader} from "@react-three/fiber";
import {useTexture} from "@react-three/drei";
import {RGBELoader} from "three/addons/loaders/RGBELoader.js";
import {scenicHDR,scenicSky} from "./lighting";

// 冷入口先在提交阶段启动环境资源，再让 Suspense 读取；不在渲染中通知上一空间的进度订阅者。
// 这里只启动共享缓存，原环境仍拥有 PMREM / 采样器，原 WorldWarmup 仍负责实际可见内容就绪。
export default function ScenicPreparation({children}:{children:ReactNode}){
  const [started,setStarted]=useState(false);
  useEffect(()=>{
    useTexture.preload(scenicSky);useLoader.preload(RGBELoader,scenicHDR);
    setStarted(true);
  },[]);
  return started?children:null;
}
