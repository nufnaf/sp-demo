"use client";

import "./DesktopStartStage.css";

export type StartScene = "research" | "files" | "apps";

const scenes = {
  research: { label: "做个研究", output: "一份可以继续追问的研究报告" },
  files: { label: "整理材料", output: "从长篇材料，到重点与行动" },
  apps: { label: "推进工作", output: "连接后，用你的真实信息开始" },
};

export function DesktopStartStage({ scene, onSceneChange, onDismiss }: {
  scene: StartScene;
  onSceneChange: (scene: StartScene) => void;
  onDismiss: () => void;
}) {
  const current = scenes[scene];
  return <section className={`desktop-start-stage scene-${scene}`} aria-label="开始使用 Syntropic">
    <button type="button" className="stage-dismiss" aria-label="收起开始引导" onClick={onDismiss}>×</button>
    <header className="stage-heading"><h1>让事情，<em>发生。</em></h1></header>
    <div className="stage-scene-picker" role="group" aria-label="选择工作场景">
      {(Object.keys(scenes) as StartScene[]).map((key) => <button type="button" key={key} aria-pressed={scene === key} onClick={() => onSceneChange(key)}>{scenes[key].label}</button>)}
    </div>
    <div className="stage-tableau" aria-label={`${current.output}，效果示意`}>
      <div className="stage-orbit" aria-hidden="true"/>
      <div className="stage-source source-back" aria-hidden="true"><span className="source-symbol">{scene === "apps" ? "◷" : scene === "files" ? "≡" : "↗"}</span><strong>{scene === "apps" ? "日程" : scene === "files" ? "会议记录" : "产品资料"}</strong><i/><i/><i/></div>
      <div className="stage-source source-front" aria-hidden="true"><span className="source-symbol">{scene === "apps" ? "✉" : scene === "files" ? "¶" : "⌕"}</span><strong>{scene === "apps" ? "消息与文档" : scene === "files" ? "项目材料" : "公开来源"}</strong><i/><i/><span className="source-tag">{scene === "research" ? "来源可追溯" : "你的工作上下文"}</span></div>
      <div className="stage-transfer" aria-hidden="true"><span/><span/><span/><b>✦</b></div>
      <article className="stage-result" key={scene}>
        <div className="stage-result-top"><span className="stage-result-mark">S</span><span>{scene === "research" ? "RESEARCH NOTE" : scene === "files" ? "ACTION BRIEF" : "DAILY BRIEF"}</span><small>效果示意</small></div>
        <h2>{scene === "research" ? "让选择，有据可依。" : scene === "files" ? "重点清楚，下一步明确。" : "今天，从重点开始。"}</h2>
        <p>{scene === "research" ? "产品对比 / 关键差异 / 来源" : scene === "files" ? "内容摘要 / 关键决策 / 行动项" : "日程安排 / 待处理事项 / 相关资料"}</p>
        {scene === "research" ? <div className="stage-comparison"><div className="comparison-labels"><span>对比维度</span><span>产品 A</span><span>产品 B</span></div>{["核心能力", "使用体验", "适用场景"].map((label, i) => <div className="comparison-row" key={label}><span>{label}</span><i style={{ "--bar": `${[82, 56, 72][i]}%` } as React.CSSProperties}/><i style={{ "--bar": `${[58, 80, 65][i]}%` } as React.CSSProperties}/></div>)}</div> : <div className="stage-brief">{(scene === "files" ? ["提炼关键信息", "整理需要确认的决策", "列出下一步行动"] : ["为下一场会议准备资料", "汇总需要处理的消息", "整理项目最新进展"]).map((text, index) => <div key={text}><span>0{index + 1}</span><strong>{text}</strong><i/></div>)}</div>}
        <footer><span className="stage-result-dot"/>{scene === "research" ? "结论与依据，在同一份报告里" : scene === "files" ? "把材料留给 Agent，把重点留给你" : "信息归拢，工作从这里继续"}<span>↗</span></footer>
      </article>
    </div>
  </section>;
}
