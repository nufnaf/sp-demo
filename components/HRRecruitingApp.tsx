"use client";
/* eslint-disable @next/next/no-img-element -- connector logos may be remote vendor assets */

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import "./HRRecruitingApp.css";
import "./RecruitingDesign.css";
import { RecruitingPipeline } from "./RecruitingPipeline";
import type { RecruitingScene } from "@/lib/recruiting-scene";
import type { InsightResult } from "@/lib/insight-automation";
import { RecruitingBrandIcon } from "./RecruitingBrandIcon";
import { AppBrandImage } from "./AppBrandImage";
import { getChinaAppDefinition } from "@/lib/china-apps";
import { BOSS_DEMO_ACCOUNT } from "@/lib/boss-demo";
import type { PublishedRecruitingJob } from "@/lib/recruiting-publication";

type HRSection = "overview" | "candidates" | "jobs" | "sources";
type CandidateStage = "全部" | "人才库" | "初筛" | "面试" | "终面" | "Offer";

interface Candidate {
  id: string;
  name: string;
  initials: string;
  role: string;
  strengths: string;
  stage: Exclude<CandidateStage, "全部">;
  status: string;
  next: string;
  source: string;
  score: number;
  owner: string;
  note: string;
}

type RecruitingSourceId = "feishu" | "boss-zhipin" | "beisen" | "company-careers";

interface DataSource {
  id: RecruitingSourceId;
  name: string;
  description: string;
  logoUrl?: string;
  fallback: string;
  appManaged: boolean;
}

interface SourceStatus {
  installed: boolean;
  runtimeReady: boolean;
  authState: "authenticated" | "not_authenticated" | "unknown";
  detail: string;
  account?: string;
  baseUrl?: string;
  quickConnectAvailable?: boolean;
  loading: boolean;
  error?: string;
}

interface CompanyCareersData {
  sourceName: string;
  syncedAt: string;
  jobs: Array<{ id: string; title: string; location: string; headcount: number; status: string; summary: string; owner: string }>;
  candidates: Array<{ id: string; name: string; currentTitle: string; city: string; experienceYears: number; topDegree: "本科" | "硕士" | "博士"; educationSchool: string; schoolTier: string; agentExperienceYears: number; productionAgentProjects: number; strongestEvidence: string; skills: string[]; source: string; matchScore: number }>;
  applications: Array<{ id: string; jobId: string; candidateId: string; stage: "talent_pool" | "screening" | "interview" | "final" | "offer"; status: string; owner: string; nextAction: string; nextActionAt: string | null; lastDecisionBy: string | null; decisionReason: string | null }>;
  metrics: { openJobs: number; totalHeadcount: number; activeCandidates: number; offers: number; stages: Record<string, number>; updatedAt: string };
  interviewerAlignment: InterviewerAlignmentCase;
}

interface InterviewerAlignmentCase {
  id: string;
  title: string;
  summary: string;
  sample: { periodDays: number; candidates: number; evaluations: number };
  causalChain: Array<{ label: string; detail: string }>;
  interviewers: Array<{ id: string; name: string; role: string; evaluationCount: number; schoolBackgroundWeight: number; productionExperienceWeight: number; conclusion: string }>;
  impact: { highMatchCandidates: number; incorrectlyRejected: number; candidateIds: string[]; explanation: string };
  proposedStandard: { version: string; principles: Array<{ id: string; category: string; title: string; description: string; changed: boolean }>; reviewCandidateIds: string[] };
  meetingProposal: {
    title: string;
    durationMinutes: number;
    attendees: Array<{ name: string; role: string }>;
    recommendedSlot: { startsAt: string; endsAt: string; reason: string };
    alternativeSlots: Array<{ startsAt: string; endsAt: string }>;
    agenda: string[];
    materials: string[];
  };
  sources: Array<{ name: string; detail: string; updatedAt: string }>;
}

interface RecruitingJob {
  id: string;
  title: string;
  location: string;
  headcount: number;
  status: string;
  summary: string;
  owner: string;
  source: string;
}

const MANUAL_DATA_KEY_PREFIX = "agent-os:hr-manual-data:";
const LINKED_APPS_KEY_PREFIX = "agent-os:hr-linked-apps:";

const SOURCES: DataSource[] = [
  { id: "feishu", name: "飞书招聘", description: "候选人、面试评价与招聘流程", logoUrl: getChinaAppDefinition("feishu")?.logoUrl, fallback: "飞", appManaged: true },
  { id: "boss-zhipin", name: "BOSS 直聘", description: "职位发布、沟通与候选人简历", logoUrl: getChinaAppDefinition("boss-zhipin")?.logoUrl, fallback: "B", appManaged: true },
  { id: "beisen", name: "北森 iTalent", description: "招聘需求、职位、应聘者与 Offer 流程", logoUrl: getChinaAppDefinition("beisen")?.logoUrl, fallback: "北", appManaged: true },
  { id: "company-careers", name: "星流科技招聘官网", description: "官网职位、候选人投递与招聘流程", logoUrl: "/icons/company-careers-logo.svg", fallback: "招", appManaged: true },
];

const EMPTY_SOURCE_STATUS: SourceStatus = { installed: false, runtimeReady: false, authState: "unknown", detail: "正在检测…", loading: true };

function HRIcon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

const icons = {
  overview: <HRIcon><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></HRIcon>,
  candidates: <HRIcon><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M18 10v7M14.5 13.5h7"/></HRIcon>,
  jobs: <HRIcon><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M8 6V4h8v2M3 11h18M10 14h4"/></HRIcon>,
  sources: <HRIcon><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></HRIcon>,
  search: <HRIcon size={15}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></HRIcon>,
  close: <HRIcon size={15}><path d="m7 7 10 10M17 7 7 17"/></HRIcon>,
};

export function HRRecruitingApp({ cwd, onStartTask, onOpenSource, onNotice, publishedDraft, onOpenPublishedJob, presentation = false, onOpenInsight, candidateRequest }: {
  candidateRequest?: { id: number; jobId: string };
  presentation?: boolean;
  onOpenInsight?: (result: InsightResult) => void;
  publishedDraft?: string;
  onOpenPublishedJob?: (url: string) => void;
  cwd: string | null;
  onStartTask: (message: string) => Promise<string | null>;
  onOpenSource: (sourceId: Exclude<RecruitingSourceId, "company-careers">) => void;
  onNotice: (message: string) => void;
}) {
  const [scene, setScene] = useState<RecruitingScene | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [internalJobs, setInternalJobs] = useState<PublishedRecruitingJob[]>([]);
  const [internalError, setInternalError] = useState(false);
  const [internalConnected, setInternalConnected] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setInternalJobs([]);
    const refresh = async () => {
      try {
        const response = await fetch("/api/apps/internal-recruiting", { cache: "no-store" });
        const data = await response.json() as { jobs?: PublishedRecruitingJob[]; scene?: RecruitingScene; baseUrl?: string };
        if (!response.ok || !data.jobs) throw new Error("Unavailable");
        if (!cancelled) { setInternalJobs(data.jobs); setScene(data.scene ?? null); setSiteUrl(data.baseUrl ?? ""); setInternalError(false); setInternalConnected(true); }
      } catch { if (!cancelled) { setInternalError(true); setInternalConnected(false); } }
    };
    void refresh();
    window.addEventListener("agent-os:presentation-changed", refresh);
    return () => { cancelled = true; window.removeEventListener("agent-os:presentation-changed", refresh); };
  }, [cwd, publishedDraft]);
  useEffect(() => { if (publishedDraft) setSection("jobs"); }, [publishedDraft]);
  const [section, setSection] = useState<HRSection>("overview");
  useEffect(() => { if (candidateRequest) setSection("candidates"); }, [candidateRequest]);
  const [stage, setStage] = useState<CandidateStage>("全部");
  const [query, setQuery] = useState("");
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [manualJobs, setManualJobs] = useState<RecruitingJob[]>([]);
  const [manualCandidates, setManualCandidates] = useState<Candidate[]>([]);
  const [creationMode, setCreationMode] = useState<"job" | "candidate" | null>(null);
  const [draftJob, setDraftJob] = useState({ title: "", location: "", headcount: "1" });
  const [draftCandidate, setDraftCandidate] = useState({ name: "", jobId: "", strengths: "" });
  const [sourceStatuses, setSourceStatuses] = useState<Record<RecruitingSourceId, SourceStatus>>({
    feishu: EMPTY_SOURCE_STATUS,
    "boss-zhipin": EMPTY_SOURCE_STATUS,
    beisen: EMPTY_SOURCE_STATUS,
    "company-careers": EMPTY_SOURCE_STATUS,
  });
  const [companyCareersData, setCompanyCareersData] = useState<CompanyCareersData | null>(null);
  const [sourceBusy, setSourceBusy] = useState<RecruitingSourceId | null>(null);
  const [taskBusy, setTaskBusy] = useState(false);
  const [companyConnectOpen, setCompanyConnectOpen] = useState(false);
  const [companyBaseUrl, setCompanyBaseUrl] = useState("https://company-recruiting-site.vercel.app");
  const [companyToken, setCompanyToken] = useState("");
  const [linkedSourceIds, setLinkedSourceIds] = useState<Set<RecruitingSourceId>>(() => new Set());

  const refreshSourceStatuses = useCallback(async () => {
    const readJson = async <T,>(url: string): Promise<T> => {
      const response = await fetch(url, { cache: "no-store" });
      const body = await response.json() as T & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "状态检测失败");
      return body;
    };
    try {
      const installations = await readJson<{ installed?: string[]; builtins?: string[] }>("/api/app-store/installations");
      const installed = new Set([...(installations.builtins ?? []), ...(installations.installed ?? [])]);
      if (presentation) {
        const unavailable = { installed: false, runtimeReady: false, authState: "not_authenticated" as const, loading: false, detail: "该应用暂不可用" };
        setSourceStatuses({
          feishu: { ...unavailable, installed: installed.has("feishu"), runtimeReady: true, detail: "团队文档已接入，招聘数据尚未连接" },
          "boss-zhipin": { ...unavailable, installed: installed.has("boss-zhipin"), runtimeReady: true,
            authState: installed.has("boss-zhipin") ? "authenticated" : "not_authenticated",
            account: BOSS_DEMO_ACCOUNT, detail: "招聘账号已连接" },
          beisen: { ...unavailable, installed: installed.has("beisen") },
          "company-careers": unavailable,
        });
        return;
      }
      const checks = await Promise.allSettled([
        readJson<{ installed: boolean; authState: SourceStatus["authState"]; authDetail: string; account?: string }>("/api/apps/feishu"),
        readJson<{ installed: boolean; authState: SourceStatus["authState"]; authDetail: string; account?: string; organization?: string }>("/api/apps/boss-zhipin/cli"),
        readJson<{ installed: boolean; authState: SourceStatus["authState"]; authDetail: string; account?: string; organization?: string }>("/api/apps/beisen/cli"),
        readJson<{ installed: boolean; runtimeReady: boolean; authState: SourceStatus["authState"]; authDetail: string; account?: string; organization?: string; baseUrl?: string; quickConnectAvailable?: boolean }>("/api/apps/company-careers"),
      ]);
      const ids = ["feishu", "boss-zhipin", "beisen", "company-careers"] as const;
      setSourceStatuses((current) => {
        const next = { ...current };
        checks.forEach((result, index) => {
          const id = ids[index];
          if (result.status === "rejected") {
            next[id] = { installed: installed.has(id), runtimeReady: false, authState: "unknown", detail: "暂时无法读取连接状态", loading: false, error: result.reason instanceof Error ? result.reason.message : String(result.reason) };
            return;
          }
          const value = result.value;
          next[id] = {
            installed: id === "company-careers" ? value.installed : installed.has(id),
            runtimeReady: value.installed,
            authState: value.authState,
            detail: value.authDetail,
            account: [value.account, "organization" in value ? value.organization : undefined].filter(Boolean).join(" · ") || undefined,
            baseUrl: "baseUrl" in value ? value.baseUrl : undefined,
            quickConnectAvailable: "quickConnectAvailable" in value ? value.quickConnectAvailable : undefined,
            loading: false,
          };
        });
        return next;
      });
      if (checks[3]?.status === "fulfilled" && checks[3].value.authState === "authenticated") {
        try {
          setCompanyCareersData(await readJson<CompanyCareersData>("/api/apps/company-careers/data"));
        } catch {
          setCompanyCareersData(null);
        }
      } else {
        setCompanyCareersData(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSourceStatuses((current) => Object.fromEntries(Object.entries(current).map(([id, status]) => [id, { ...status, loading: false, error: message, detail: "暂时无法读取安装状态" }])) as Record<RecruitingSourceId, SourceStatus>);
    }
  }, [presentation]);

  useEffect(() => {
    void refreshSourceStatuses();
    const refresh = () => void refreshSourceStatuses();
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("agent-os:apps-changed", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("agent-os:apps-changed", refresh); };
  }, [refreshSourceStatuses]);

  useEffect(() => {
    if (!cwd) {
      setManualJobs([]);
      setManualCandidates([]);
      setLinkedSourceIds(new Set());
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(`${MANUAL_DATA_KEY_PREFIX}${cwd}`) ?? "{}") as { jobs?: RecruitingJob[]; candidates?: Candidate[] };
      setManualJobs(Array.isArray(stored.jobs) ? stored.jobs : []);
      setManualCandidates(Array.isArray(stored.candidates) ? stored.candidates : []);
    } catch {
      setManualJobs([]);
      setManualCandidates([]);
    }
    try {
      const stored = JSON.parse(localStorage.getItem(`${LINKED_APPS_KEY_PREFIX}${cwd}`) ?? (presentation ? '["boss-zhipin"]' : "[]")) as unknown;
      setLinkedSourceIds(new Set(Array.isArray(stored) ? stored.filter((id): id is RecruitingSourceId => SOURCES.some((source) => source.id === id)) : []));
    } catch {
      setLinkedSourceIds(new Set());
    }
  }, [cwd, presentation]);

  const persistLinkedApps = useCallback((next: Set<RecruitingSourceId>) => {
    setLinkedSourceIds(next);
    if (cwd) localStorage.setItem(`${LINKED_APPS_KEY_PREFIX}${cwd}`, JSON.stringify([...next]));
  }, [cwd]);

  const remoteCandidates = useMemo(() => {
    if (!companyCareersData || !linkedSourceIds.has("company-careers")) return [];
    const stageMap = { talent_pool: "人才库", screening: "初筛", interview: "面试", final: "终面", offer: "Offer" } as const;
    return companyCareersData.applications.flatMap((application): Candidate[] => {
      const candidate = companyCareersData.candidates.find((item) => item.id === application.candidateId);
      const job = companyCareersData.jobs.find((item) => item.id === application.jobId);
      if (!candidate || !job) return [];
      const next = application.nextActionAt
        ? new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(application.nextActionAt))
        : application.nextAction;
      const decision = application.decisionReason ? `最近结论：${application.decisionReason}。` : "";
      return [{ id: candidate.id, name: candidate.name, initials: candidate.name.slice(0, 1), role: job.title, strengths: candidate.skills.join(" · ") || candidate.currentTitle, stage: stageMap[application.stage], status: application.status, next, source: candidate.source, score: candidate.matchScore, owner: application.owner, note: `${candidate.currentTitle}，${candidate.city}，${candidate.topDegree} · ${candidate.educationSchool}，${candidate.experienceYears} 年经验 / ${candidate.agentExperienceYears} 年 Agent 经验。关键证据：${candidate.strongestEvidence}。${decision}下一步：${application.nextAction}` }];
    });
  }, [companyCareersData, linkedSourceIds]);
  const jobs = useMemo<RecruitingJob[]>(() => [
    ...manualJobs,
    ...(linkedSourceIds.has("company-careers") ? companyCareersData?.jobs ?? [] : []).map((job) => ({ ...job, source: companyCareersData?.sourceName ?? "公司招聘官网" })),
  ], [companyCareersData, linkedSourceIds, manualJobs]);
  const candidates = useMemo(() => [...manualCandidates, ...remoteCandidates], [manualCandidates, remoteCandidates]);
  useEffect(() => {
    if (activeJobId && jobs.some((job) => job.id === activeJobId)) return;
    setActiveJobId(jobs[0]?.id ?? null);
  }, [activeJobId, jobs]);
  const activeJob = jobs.find((job) => job.id === activeJobId) ?? null;
  const roleName = activeJob?.title ?? "";
  const roleCandidates = candidates.filter((candidate) => candidate.role === roleName);
  const rolePipeline = (["人才库", "初筛", "面试", "终面", "Offer"] as const).map((item) => roleCandidates.filter((candidate) => candidate.stage === item).length);
  const stageCounts = (["人才库", "初筛", "面试", "终面", "Offer"] as const).map((item) => ({
    label: item,
    count: rolePipeline[["人才库", "初筛", "面试", "终面", "Offer"].indexOf(item)],
  }));
  const visibleCandidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return candidates.filter((candidate) => (stage === "全部" || candidate.stage === stage)
      && (!normalized || `${candidate.name} ${candidate.role} ${candidate.strengths} ${candidate.source}`.toLocaleLowerCase().includes(normalized)));
  }, [candidates, query, stage]);
  const activeCandidate = candidates.find((candidate) => candidate.id === activeCandidateId) ?? null;

  const createFollowupTask = async (candidate: Candidate) => {
    setTaskBusy(true);
    const result = await onStartTask(`作为招聘协作 Agent，请推进候选人「${candidate.name}」的招聘流程。\n\n岗位：${candidate.role}\n当前阶段：${candidate.stage}\n当前状态：${candidate.status}\n下一节点：${candidate.next}\n负责人：${candidate.owner}\n补充信息：${candidate.note}\n\n请先核对当前工作台中可访问的招聘数据与日历，给出并执行安全范围内的下一步；任何对候选人或面试官的外部消息都先生成草稿，等待 HR 确认。`);
    if (result) onNotice(`已创建「跟进 ${candidate.name}」招聘任务`);
    setTaskBusy(false);
  };

  const manageSource = async (source: DataSource) => {
    if (source.id === "company-careers") {
      const status = sourceStatuses[source.id];
      if (linkedSourceIds.has(source.id) && status.authState === "authenticated" && status.baseUrl) {
        window.open(status.baseUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (!cwd) {
        onNotice("请先选择一个工作台");
        return;
      }
      if (!status.quickConnectAvailable) {
        setCompanyConnectOpen(true);
        return;
      }
      setSourceBusy(source.id);
      try {
        const response = await fetch("/api/apps/company-careers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cwd, useSavedDemo: true }),
        });
        const body = await response.json() as { error?: string };
        if (!response.ok) throw new Error(body.error ?? "连接失败");
        persistLinkedApps(new Set([...linkedSourceIds, source.id]));
        await refreshSourceStatuses();
        onNotice("星流科技招聘官网已接入人才招聘");
      } catch (error) {
        onNotice(error instanceof Error ? error.message : String(error));
      } finally {
        setSourceBusy(null);
      }
      return;
    }
    const status = sourceStatuses[source.id];
    if (linkedSourceIds.has(source.id)) {
      onOpenSource(source.id);
      return;
    }
    if (status.authState === "authenticated") {
      persistLinkedApps(new Set([...linkedSourceIds, source.id]));
      onNotice(`${source.name} 已接入人才招聘`);
      return;
    }
    if (status.installed) {
      onOpenSource(source.id);
      return;
    }
    setSourceBusy(source.id);
    try {
      const response = await fetch("/api/app-store/installations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appId: source.id }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "安装失败");
      window.dispatchEvent(new CustomEvent("agent-os:apps-changed"));
      await refreshSourceStatuses();
      onNotice(`${source.name} 已安装，请完成账号授权`);
      onOpenSource(source.id);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSourceBusy(null);
    }
  };

  const connectCompanyCareers = async (event: FormEvent) => {
    event.preventDefault();
    if (!cwd) return onNotice("请先选择一个工作台");
    setSourceBusy("company-careers");
    try {
      const response = await fetch("/api/apps/company-careers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, baseUrl: companyBaseUrl, token: companyToken }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "连接失败");
      persistLinkedApps(new Set([...linkedSourceIds, "company-careers"]));
      setCompanyConnectOpen(false);
      setCompanyToken("");
      await refreshSourceStatuses();
      onNotice("星流科技招聘官网已接入人才招聘");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSourceBusy(null);
    }
  };

  const disconnectCompanyCareers = async () => {
    setSourceBusy("company-careers");
    try {
      const params = cwd ? `?cwd=${encodeURIComponent(cwd)}` : "";
      const response = await fetch(`/api/apps/company-careers${params}`, { method: "DELETE" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "解绑失败");
      const next = new Set(linkedSourceIds);
      next.delete("company-careers");
      persistLinkedApps(next);
      setCompanyCareersData(null);
      await refreshSourceStatuses();
      onNotice("星流科技招聘官网已从人才招聘断开");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSourceBusy(null);
    }
  };

  const disconnectRecruitingApp = async (source: DataSource) => {
    if (source.id === "company-careers") {
      await disconnectCompanyCareers();
      return;
    }
    const next = new Set(linkedSourceIds);
    next.delete(source.id);
    persistLinkedApps(next);
    onNotice(`${source.name} 已从人才招聘断开`);
  };

  const persistManualData = (nextJobs: RecruitingJob[], nextCandidates: Candidate[]) => {
    setManualJobs(nextJobs);
    setManualCandidates(nextCandidates);
    if (cwd) localStorage.setItem(`${MANUAL_DATA_KEY_PREFIX}${cwd}`, JSON.stringify({ jobs: nextJobs, candidates: nextCandidates }));
  };

  const createManualJob = (event: FormEvent) => {
    event.preventDefault();
    const title = draftJob.title.trim();
    const headcount = Math.max(1, Number.parseInt(draftJob.headcount, 10) || 1);
    if (!title) return;
    const job: RecruitingJob = {
      id: `manual-job-${Date.now()}`,
      title,
      location: draftJob.location.trim() || "待确认",
      headcount,
      status: "招聘中",
      summary: "由 HR 手动创建",
      owner: "当前 HR",
      source: "手动创建",
    };
    persistManualData([...manualJobs, job], manualCandidates);
    setActiveJobId(job.id);
    setDraftJob({ title: "", location: "", headcount: "1" });
    setCreationMode(null);
    onNotice(`已创建岗位「${job.title}」`);
  };

  const createManualCandidate = (event: FormEvent) => {
    event.preventDefault();
    const name = draftCandidate.name.trim();
    const job = jobs.find((item) => item.id === draftCandidate.jobId);
    if (!name || !job) return;
    const candidate: Candidate = {
      id: `manual-candidate-${Date.now()}`,
      name,
      initials: name.slice(0, 1),
      role: job.title,
      strengths: draftCandidate.strengths.trim() || "待补充",
      stage: "人才库",
      status: "待初筛",
      next: "等待安排",
      source: "手动创建",
      score: 0,
      owner: "当前 HR",
      note: "由 HR 手动录入，等待补充候选人信息。",
    };
    persistManualData(manualJobs, [...manualCandidates, candidate]);
    setActiveJobId(job.id);
    setDraftCandidate({ name: "", jobId: "", strengths: "" });
    setCreationMode(null);
    onNotice(`已创建候选人「${candidate.name}」`);
  };

  const connectedCount = SOURCES.filter((source) => linkedSourceIds.has(source.id) && sourceStatuses[source.id].authState === "authenticated").length;

  return <div className="hr-recruiting-app os-workspace">
    <aside className="hr-recruiting-sidebar">
      <header><RecruitingBrandIcon/><span><strong>人才招聘</strong></span></header>
      <nav aria-label="人才招聘功能">
        {([
          ["overview", "招聘进展", icons.overview],
          ["candidates", "候选人", icons.candidates],
          ["jobs", "岗位管理", icons.jobs],
          ["sources", "招聘应用", icons.sources],
        ] as Array<[HRSection, string, ReactNode]>).map(([id, label, icon]) => <button type="button" key={id} aria-label={label} title={label} className={section === id ? "selected" : ""} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}>{icon}<span><strong>{label}</strong><small>{id === "overview" ? "候选人管道" : id === "jobs" ? `${internalJobs.length + jobs.length} 个岗位` : id === "candidates" ? "搜索与查看档案" : "管理数据连接"}</small></span>{id === "sources" ? <em>{connectedCount}</em> : null}</button>)}
      </nav>
      <div className="hr-recruiting-roles">
        <span>在招岗位</span>
        {internalJobs.map((job) => <button type="button" key={job.id} onClick={() => setSection(scene ? "overview" : "jobs")}><i/><span><strong>{job.title}</strong><small>{job.headcount} 个 HC · 内部招聘系统</small></span></button>)}
        {jobs.length ? jobs.map((job) => <button type="button" key={job.id} className={activeJobId === job.id ? "selected" : ""} onClick={() => { setActiveJobId(job.id); setSection("overview"); }}><i/><span><strong>{job.title}</strong><small>{job.headcount} 个 HC · {job.source}</small></span></button>) : internalJobs.length ? null : <p className="hr-sidebar-empty">连接招聘应用或新建岗位</p>}
      </div>
      <footer><i className={connectedCount || internalConnected ? "connected" : ""}/><span><strong>{presentation ? `本轮已发布 ${internalJobs.length} 个岗位` : internalConnected ? "内部招聘系统已连接" : `${connectedCount} 个招聘应用已连接`}</strong><small>{presentation ? "发布或查询后更新" : "连接状态实时检测"}</small></span></footer>
    </aside>

    <main className="hr-recruiting-main">
      {(presentation || scene) && (section === "overview" || section === "candidates") && <RecruitingPipeline key={candidateRequest?.id ?? "default"} initialFilter={candidateRequest?.jobId === scene?.job?.id ? "missing" : ""} scene={scene} cwd={cwd!} onOpenInsight={(result) => onOpenInsight?.(result)} onOpenWebsite={(path) => onOpenPublishedJob?.(new URL(path.replace(/^\//, ""), siteUrl).href)}/>}
      {!presentation && !scene && section === "overview" ? <>
        {activeJob ? <><header className="hr-recruiting-hero"><span><small>招聘目标</small><h1>{roleName}</h1><p>目标招聘 {activeJob.headcount} 位 · {activeJob.location} · {activeJob.source}</p></span><em className="steady"><i/>{activeJob.status}</em></header>
          <section className="hr-recruiting-pipeline"><header><span><strong>招聘管道</strong><small>点击阶段查看全部候选人</small></span><button type="button" onClick={() => { setStage("全部"); setSection("candidates"); }}>查看全部</button></header><div>{stageCounts.map((item) => <button type="button" key={item.label} onClick={() => { setStage(item.label); setSection("candidates"); }}><small>{item.label}</small><strong>{item.count}</strong><i style={{ width: `${roleCandidates.length ? Math.max(5, item.count / roleCandidates.length * 100) : 0}%` }}/></button>)}</div></section>
          <CandidateTable candidates={roleCandidates.slice(0, 4)} onOpen={setActiveCandidateId} title="重点候选人" subtitle={`${Math.min(roleCandidates.length, 4)} 条记录 · 来自招聘应用或手动创建`}/></> : <EmptyRecruitingState onConnect={() => setSection("sources")} onCreate={() => setCreationMode("job")}/>}
      </> : null}

      {!presentation && !scene && section === "candidates" ? <>
        <header className="hr-recruiting-page-header"><span><small>人才库</small><h1>候选人</h1><p>来自已连接招聘系统和 HR 手动创建的候选人</p></span><button type="button" disabled={!jobs.length} onClick={() => { setDraftCandidate((current) => ({ ...current, jobId: activeJobId ?? jobs[0]?.id ?? "" })); setCreationMode("candidate"); }}>新建候选人</button></header>
        <div className="hr-recruiting-toolbar"><label>{icons.search}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、岗位、能力或来源"/></label><div>{(["全部", "人才库", "初筛", "面试", "终面", "Offer"] as CandidateStage[]).map((item) => <button key={item} type="button" className={stage === item ? "selected" : ""} onClick={() => setStage(item)}>{item}</button>)}</div></div>
        <CandidateTable candidates={visibleCandidates} onOpen={setActiveCandidateId} title={`${stage === "全部" ? "全部" : stage}候选人`} subtitle={`${visibleCandidates.length} 条记录`}/>
      </> : null}

      {section === "jobs" ? <>
        <header className="hr-recruiting-page-header"><span><small>岗位管理</small><h1>招聘岗位</h1><p>来自已连接招聘系统和 HR 手动创建的岗位</p></span><button type="button" onClick={() => setCreationMode("job")}>新建岗位</button></header>
        {internalJobs.length > 0 && <section className="hr-internal-published"><h2>{presentation ? "招聘渠道" : "内部招聘系统"} · 已发布 {internalJobs.length} 个职位</h2><div className="hr-jobs-grid">{internalJobs.map((job) => <button type="button" key={job.id} className={job.draft === publishedDraft ? "just-published" : ""} onClick={() => scene ? setSection("overview") : onOpenPublishedJob?.(job.url)}><header><span>{icons.jobs}</span><em>已发布</em></header><strong>{job.title}</strong><small>{job.location} · {job.headcount} 个 HC</small><dl><div><dt>发布渠道</dt><dd>{job.bossPublication?.status === "published" ? "内部招聘系统 · BOSS 直聘" : "内部招聘系统 · 已发布"}</dd></div><div><dt>当前进展</dt><dd>{job.candidateCount} 位候选人</dd></div></dl><span className="hr-channel-tags"><i>内部招聘系统 · 已发布</i><i>{job.bossPublication?.status === "published" ? "BOSS 直聘 · 已发布" : "BOSS 直聘 · 未发布"}</i></span><footer><span>{scene ? "查看招聘进展" : "查看职位详情"}</span><b>↗</b></footer></button>)}</div></section>}
        {internalError && <p className="hr-sidebar-empty">内部招聘系统暂时无法读取，请稍后刷新。</p>}
        {jobs.length ? <section className="hr-jobs-grid">{jobs.map((job) => { const jobCandidates = candidates.filter((candidate) => candidate.role === job.title); return <button type="button" key={job.id} onClick={() => { setActiveJobId(job.id); setSection("overview"); }}><header><span>{icons.jobs}</span><em>{job.status}</em></header><strong>{job.title}</strong><small>{job.location} · {job.headcount} 个 HC</small><dl><div><dt>数据来源</dt><dd>{job.source}</dd></div><div><dt>当前进展</dt><dd>{jobCandidates.length} 位候选人</dd></div></dl><footer><span>查看招聘进展</span><b>›</b></footer></button>; })}</section> : internalJobs.length ? null : <EmptyRecruitingState compact onConnect={() => setSection("sources")} onCreate={() => setCreationMode("job")}/>}
      </> : null}

      {section === "sources" ? <>
        <header className="hr-recruiting-page-header"><span><small>应用连接</small><h1>招聘应用</h1><p>连接企业招聘应用，将岗位、候选人和流程汇集到招聘工作台</p></span></header>
        <section className="hr-source-summary"><span>{icons.sources}</span><div><strong>统一招聘数据</strong><p>{companyCareersData && linkedSourceIds.has("company-careers") ? `已从${companyCareersData.sourceName}同步 ${companyCareersData.jobs.length} 个岗位、${companyCareersData.candidates.length} 位候选人。` : "已安装或授权的 OS 应用不会自动接入；连接后才会同步对应的招聘数据。"}</p></div><em>{connectedCount} / {SOURCES.length} 已连接</em></section>
        <section className="hr-source-grid">{SOURCES.map((source) => {
          const status = sourceStatuses[source.id];
          const connected = linkedSourceIds.has(source.id) && status.authState === "authenticated";
          const stateLabel = status.loading ? "检测中" : status.error ? "检测失败" : connected ? "已连接" : status.authState === "authenticated" ? "可连接" : !status.installed ? "未安装" : !status.runtimeReady ? "待初始化" : status.authState === "unknown" ? "待验证" : "待授权";
          const presetUnavailable = presentation && source.id !== "boss-zhipin";
          const buttonLabel = presetUnavailable ? "暂不可用" : sourceBusy === source.id ? "处理中…" : connected ? "打开应用" : status.authState === "authenticated" || source.id === "company-careers" ? "连接应用" : !source.appManaged ? "需要专属连接器" : status.installed ? "完成授权" : "安装应用";
          return <article key={source.id} className={status.error ? "has-error" : ""}><header><span className={`hr-source-logo is-${source.id}`}>{source.logoUrl ? <AppBrandImage appId={source.id} src={source.logoUrl}/> : source.fallback}</span><em className={connected ? "connected" : status.error ? "error" : status.loading ? "loading" : ""}><i/>{stateLabel}</em></header><h2>{source.name}</h2><p>{source.description}</p><small>{status.account ?? status.error ?? status.detail}</small><div className="hr-source-actions"><button type="button" className={connected ? "connected" : ""} disabled={presetUnavailable || status.loading || sourceBusy === source.id || !source.appManaged} onClick={() => { void manageSource(source); }}>{buttonLabel}</button>{connected ? <button type="button" className="disconnect" disabled={sourceBusy === source.id} onClick={() => void disconnectRecruitingApp(source)}>断开</button> : null}</div></article>;
        })}</section>
        {companyConnectOpen ? <aside className="hr-source-modal"><form onSubmit={(event) => void connectCompanyCareers(event)}><header><span className="hr-source-logo is-company-careers"><img src="/icons/company-careers-logo.svg" alt=""/></span><span><strong>星流科技招聘官网</strong><small>连接招聘应用</small></span><button type="button" aria-label="关闭连接配置" onClick={() => setCompanyConnectOpen(false)}>{icons.close}</button></header><label><span>招聘官网地址</span><input type="url" required value={companyBaseUrl} onChange={(event) => setCompanyBaseUrl(event.target.value)}/></label><label><span>访问令牌</span><input type="password" required autoComplete="off" value={companyToken} onChange={(event) => setCompanyToken(event.target.value)} placeholder="输入网站提供的访问令牌"/></label><footer><button type="button" onClick={() => setCompanyConnectOpen(false)}>取消</button><button type="submit" disabled={sourceBusy === "company-careers"}>{sourceBusy === "company-careers" ? "正在验证…" : "连接应用"}</button></footer></form></aside> : null}
      </> : null}
    </main>

    {creationMode === "job" ? <aside className="hr-source-modal"><form onSubmit={createManualJob}><header><span className="hr-manual-icon">岗</span><span><strong>新建招聘岗位</strong><small>手动创建的数据会保存在当前工作台</small></span><button type="button" aria-label="关闭" onClick={() => setCreationMode(null)}>{icons.close}</button></header><label><span>岗位名称</span><input required value={draftJob.title} onChange={(event) => setDraftJob((current) => ({ ...current, title: event.target.value }))} placeholder="例如：高级 AI Agent 研发工程师"/></label><label><span>工作地点</span><input value={draftJob.location} onChange={(event) => setDraftJob((current) => ({ ...current, location: event.target.value }))} placeholder="例如：北京 / 上海"/></label><label><span>招聘人数</span><input type="number" min="1" required value={draftJob.headcount} onChange={(event) => setDraftJob((current) => ({ ...current, headcount: event.target.value }))}/></label><footer><button type="button" onClick={() => setCreationMode(null)}>取消</button><button type="submit">创建岗位</button></footer></form></aside> : null}

    {creationMode === "candidate" ? <aside className="hr-source-modal"><form onSubmit={createManualCandidate}><header><span className="hr-manual-icon">人</span><span><strong>新建候选人</strong><small>候选人将进入所选岗位的人才库</small></span><button type="button" aria-label="关闭" onClick={() => setCreationMode(null)}>{icons.close}</button></header><label><span>姓名</span><input required value={draftCandidate.name} onChange={(event) => setDraftCandidate((current) => ({ ...current, name: event.target.value }))}/></label><label><span>应聘岗位</span><select required value={draftCandidate.jobId} onChange={(event) => setDraftCandidate((current) => ({ ...current, jobId: event.target.value }))}><option value="">请选择岗位</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><label><span>能力摘要</span><input value={draftCandidate.strengths} onChange={(event) => setDraftCandidate((current) => ({ ...current, strengths: event.target.value }))} placeholder="例如：Agent 工具编排、评估体系"/></label><footer><button type="button" onClick={() => setCreationMode(null)}>取消</button><button type="submit">创建候选人</button></footer></form></aside> : null}

    {activeCandidate ? <aside className="hr-candidate-drawer" aria-label={`${activeCandidate.name}候选人详情`}><header><button type="button" aria-label="关闭候选人详情" onClick={() => setActiveCandidateId(null)}>{icons.close}</button><span className="avatar">{activeCandidate.initials}</span><h2>{activeCandidate.name}</h2><p>{activeCandidate.role}</p><em>{activeCandidate.score}% 匹配</em></header><section><dl><div><dt>当前阶段</dt><dd>{activeCandidate.stage} · {activeCandidate.status}</dd></div><div><dt>下一节点</dt><dd>{activeCandidate.next}</dd></div><div><dt>负责人</dt><dd>{activeCandidate.owner}</dd></div><div><dt>数据来源</dt><dd>{activeCandidate.source}</dd></div></dl><article><small>候选人摘要</small><strong>{activeCandidate.strengths}</strong><p>{activeCandidate.note}</p></article><div className="hr-candidate-timeline"><small>招聘进展</small>{["简历进入人才库", "完成招聘初筛", activeCandidate.status].map((item, index) => <span key={item} className={index < 2 ? "done" : "current"}><i/ ><b>{item}</b><em>{index === 2 ? activeCandidate.next : index ? "3 天前" : "7 天前"}</em></span>)}</div></section><footer><button type="button" disabled={taskBusy} onClick={() => void createFollowupTask(activeCandidate)}>{taskBusy ? "正在创建…" : "交给 Agent 跟进"}</button></footer></aside> : null}

  </div>;
}

function EmptyRecruitingState({ compact = false, onConnect, onCreate }: { compact?: boolean; onConnect: () => void; onCreate: () => void }) {
  return <section className={`hr-recruiting-empty${compact ? " compact" : ""}`}><span>{icons.sources}</span><h2>还没有招聘数据</h2><p>连接招聘应用同步岗位和候选人，或者先手动创建一个岗位。</p><div><button type="button" onClick={onConnect}>连接招聘应用</button><button type="button" onClick={onCreate}>新建岗位</button></div></section>;
}

function CandidateTable({ candidates, onOpen, title, subtitle }: { candidates: Candidate[]; onOpen: (id: string) => void; title: string; subtitle: string }) {
  return <section className="hr-candidate-table"><header><span><strong>{title}</strong><small>{subtitle}</small></span></header><div className="head"><span>候选人</span><span>当前状态</span><span>下一节点</span><span>数据来源</span><span>匹配度</span></div><div className="rows">{candidates.length ? candidates.map((candidate) => <button type="button" key={candidate.id} onClick={() => onOpen(candidate.id)}><span className="person"><i>{candidate.initials}</i><span><strong>{candidate.name}</strong><small>{candidate.strengths}</small></span></span><em>{candidate.stage} · {candidate.status}</em><time>{candidate.next}</time><small>{candidate.source}</small><b>{candidate.score}%</b><i className="arrow">›</i></button>) : <p className="empty">没有符合当前条件的候选人</p>}</div></section>;
}
