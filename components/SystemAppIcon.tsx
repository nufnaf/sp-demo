import type { CSSProperties } from "react";
import "./SystemAppIcon.css";
export type SystemAppIconName="files"|"file"|"hr"|"tasks"|"launchpad"|"store"|"calendar"|"browser"|"feishu"|"boss";
const SOURCES:Record<SystemAppIconName,string>={files:"/icons/system/产物库.png",file:"/icons/system/文件.png",hr:"/icons/system/人才招聘.png",tasks:"/icons/system/任务.png",launchpad:"/icons/system/启动台.png",store:"/icons/system/应用市场.png",calendar:"/icons/system/日程.png",browser:"/icons/system/浏览器.png",feishu:"/icons/system/飞书.png",boss:"/icons/system/BOSS.png"};
export function SystemAppIcon({name,size,className="",style}:{name:SystemAppIconName;size?:number;className?:string;style?:CSSProperties}){return <span className={`system-app-icon ${name === "feishu" ? "system-app-icon-feishu" : ""} ${className}`.trim()} style={{...(size?{width:size,height:size}:{}),...style}} aria-hidden="true"><img src={SOURCES[name]} alt="" draggable={false}/></span>}
