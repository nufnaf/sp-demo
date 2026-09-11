"use client";
import { useEffect, useState } from "react";
export function FeishuConnectionStatus() {
  const [account, setAccount] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/apps/feishu", { cache: "no-store", signal: controller.signal }).then(async response => {
      const status = await response.json();
      if (!response.ok || status.authState !== "authenticated") throw new Error("连接已失效，请退出并重新打开 App 完成授权。");
      if (!controller.signal.aborted) setAccount(status.account || "飞书用户");
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, []);
  return <section className="agent-settings-group"><h2>飞书连接</h2><div className="agent-settings-form-list"><div><span><strong>{account || "飞书账号"}</strong><small>{error || "工作资料和招聘日历在启动时自动准备，授权保存在本机。"}</small></span><em>{error ? "需要重新连接" : account ? "已连接" : "检查中"}</em></div></div></section>;
}
