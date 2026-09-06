import "server-only";

import { readStoredAuthSection, updateStoredAuthSection } from "@/lib/provider-credential-store";

const AUTH_SECTION = "pi-web:company-careers";
const SAVED_DEMO_CONNECTION_SECTION = "pi-web:company-careers-demo-profile";
const REQUEST_TIMEOUT_MS = 8_000;

export interface CompanyCareersConnection {
  baseUrl: string;
  token: string;
}

export interface CompanyCareersStatus {
  installed: true;
  runtimeReady: boolean;
  authState: "authenticated" | "not_authenticated" | "unknown";
  authDetail: string;
  account?: string;
  organization?: string;
  baseUrl?: string;
  capabilities?: string[];
  quickConnectAvailable?: boolean;
}

export interface CompanyCareersJob {
  id: string;
  title: string;
  location: string;
  headcount: number;
  status: string;
  summary: string;
  owner: string;
}

export interface CompanyCareersCandidate {
  id: string;
  name: string;
  currentTitle: string;
  city: string;
  experienceYears: number;
  topDegree: "本科" | "硕士" | "博士";
  educationSchool: string;
  schoolTier: "顶尖院校" | "重点院校" | "普通院校" | "海外院校";
  agentExperienceYears: number;
  productionAgentProjects: number;
  strongestEvidence: string;
  skills: string[];
  source: string;
  matchScore: number;
}

export interface CompanyCareersApplication {
  id: string;
  jobId: string;
  candidateId: string;
  stage: "talent_pool" | "screening" | "interview" | "final" | "offer";
  status: string;
  owner: string;
  nextAction: string;
  nextActionAt: string | null;
  lastDecisionBy: string | null;
  decisionReason: string | null;
}

export interface CompanyCareersMetrics {
  openJobs: number;
  totalHeadcount: number;
  activeCandidates: number;
  offers: number;
  stages: Record<string, number>;
  updatedAt: string;
}

export interface CompanyCareersData {
  sourceId: "company-careers";
  sourceName: string;
  syncedAt: string;
  jobs: CompanyCareersJob[];
  candidates: CompanyCareersCandidate[];
  applications: CompanyCareersApplication[];
  metrics: CompanyCareersMetrics;
  interviewerAlignment: InterviewerAlignmentCase;
  interviewEvaluations: InterviewEvaluation[];
}

export interface InterviewEvaluation {
  id: string;
  interviewerId: string;
  candidateId: string;
  interviewType: string;
  recommendation: "strong_yes" | "yes" | "no";
  mentionedSignals: string[];
  evidenceSummary: string;
  scorecard: {
    engineeringFoundation: number;
    systemDesign: number;
    productionExperience: number;
    learningAgility: number;
  };
  decisionReasonCode: "education" | "experience" | "capability" | "evidence";
  submittedAt: string;
}

export interface InterviewerAlignmentCase {
  id: string;
  status: "needs_alignment";
  detectedAt: string;
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

export interface ScheduledAlignmentMeeting {
  id: string;
  status: "scheduled";
  title: string;
  startsAt: string;
  endsAt: string;
  attendees: Array<{ name: string; role: string }>;
  agenda: string[];
  materials: string[];
  createdAt: string;
}

interface HealthResponse {
  status?: string;
  sourceId?: string;
  sourceName?: string;
  capabilities?: string[];
}

interface DataEnvelope<T> {
  data: T;
  meta?: { sourceId?: string; sourceName?: string; syncedAt?: string };
}

function normalizeBaseUrl(value: string): string {
  const parsed = new URL(value.trim());
  const localHttp = parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  if (parsed.protocol !== "https:" && !localHttp) throw new Error("招聘官网地址必须使用 HTTPS（本地 localhost 除外）");
  if (parsed.username || parsed.password) throw new Error("招聘官网地址不能包含账号或密码");
  return parsed.origin;
}

async function readConnection(): Promise<CompanyCareersConnection | null> {
  const stored = await readStoredAuthSection(AUTH_SECTION);
  if (typeof stored?.baseUrl !== "string" || typeof stored?.token !== "string") return null;
  return { baseUrl: stored.baseUrl, token: stored.token };
}

async function readSavedDemoConnection(): Promise<CompanyCareersConnection | null> {
  const stored = await readStoredAuthSection(SAVED_DEMO_CONNECTION_SECTION);
  if (typeof stored?.baseUrl !== "string" || typeof stored?.token !== "string") return null;
  return { baseUrl: stored.baseUrl, token: stored.token };
}

async function requestJson<T>(connection: CompanyCareersConnection, pathname: string, authenticated = true, method: "GET" | "POST" = "GET"): Promise<T> {
  const response = await fetch(new URL(pathname, `${connection.baseUrl}/`), {
    method,
    cache: "no-store",
    headers: authenticated ? { Authorization: `Bearer ${connection.token}` } : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
    throw new Error(body?.message ?? body?.error ?? `招聘官网返回 HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function verifyConnection(connection: CompanyCareersConnection) {
  const health = await requestJson<HealthResponse>(connection, "/api/v1/health", false);
  if (health.status !== "ok" || health.sourceId !== "company-careers") throw new Error("目标网站不是兼容的公司招聘官网");
  const metrics = await requestJson<DataEnvelope<CompanyCareersMetrics>>(connection, "/api/v1/metrics");
  if (!metrics.data || typeof metrics.data.openJobs !== "number") throw new Error("未能读取招聘指标数据");
  return { health, metrics };
}

export async function getCompanyCareersStatus(): Promise<CompanyCareersStatus> {
  const connection = await readConnection();
  if (!connection) {
    return {
      installed: true,
      runtimeReady: true,
      authState: "not_authenticated",
      authDetail: "等待连接招聘官网",
      quickConnectAvailable: Boolean(await readSavedDemoConnection()),
    };
  }
  try {
    const { health, metrics } = await verifyConnection(connection);
    return {
      installed: true,
      runtimeReady: true,
      authState: "authenticated",
      authDetail: `已读取 ${metrics.data.openJobs} 个开放岗位、${metrics.data.activeCandidates} 位候选人`,
      account: health.sourceName ?? "公司招聘官网",
      organization: "星流科技",
      baseUrl: connection.baseUrl,
      capabilities: health.capabilities,
      quickConnectAvailable: true,
    };
  } catch (error) {
    return {
      installed: true,
      runtimeReady: true,
      authState: "not_authenticated",
      authDetail: error instanceof Error ? error.message : String(error),
      baseUrl: connection.baseUrl,
      quickConnectAvailable: true,
    };
  }
}

export async function saveCompanyCareersConnection(input: CompanyCareersConnection): Promise<CompanyCareersStatus> {
  const connection = { baseUrl: normalizeBaseUrl(input.baseUrl), token: input.token.trim() };
  if (!connection.token) throw new Error("访问令牌不能为空");
  await verifyConnection(connection);
  await updateStoredAuthSection(AUTH_SECTION, { ...connection });
  await updateStoredAuthSection(SAVED_DEMO_CONNECTION_SECTION, connection);
  return getCompanyCareersStatus();
}

export async function restoreCompanyCareersDemoConnection(): Promise<CompanyCareersStatus> {
  const connection = await readSavedDemoConnection();
  if (!connection) throw new Error("尚未保存招聘官网连接信息，请先完成配置");
  await verifyConnection(connection);
  await updateStoredAuthSection(AUTH_SECTION, { ...connection });
  return getCompanyCareersStatus();
}

export async function removeCompanyCareersConnection(): Promise<void> {
  const connection = await readConnection();
  if (connection) await updateStoredAuthSection(SAVED_DEMO_CONNECTION_SECTION, { ...connection });
  await updateStoredAuthSection(AUTH_SECTION, undefined);
}

export async function getCompanyCareersData(): Promise<CompanyCareersData> {
  const connection = await readConnection();
  if (!connection) throw new Error("公司招聘官网尚未配置");
  const [jobs, candidates, applications, metrics, interviewerAlignment, interviewEvaluations] = await Promise.all([
    requestJson<DataEnvelope<CompanyCareersJob[]>>(connection, "/api/v1/jobs"),
    requestJson<DataEnvelope<CompanyCareersCandidate[]>>(connection, "/api/v1/candidates"),
    requestJson<DataEnvelope<CompanyCareersApplication[]>>(connection, "/api/v1/applications"),
    requestJson<DataEnvelope<CompanyCareersMetrics>>(connection, "/api/v1/metrics"),
    requestJson<DataEnvelope<InterviewerAlignmentCase>>(connection, "/api/v1/cases/interviewer-alignment"),
    requestJson<DataEnvelope<InterviewEvaluation[]>>(connection, "/api/v1/interview-evaluations"),
  ]);
  return {
    sourceId: "company-careers",
    sourceName: jobs.meta?.sourceName ?? "公司招聘官网",
    syncedAt: jobs.meta?.syncedAt ?? new Date().toISOString(),
    jobs: jobs.data,
    candidates: candidates.data,
    applications: applications.data,
    metrics: metrics.data,
    interviewerAlignment: interviewerAlignment.data,
    interviewEvaluations: interviewEvaluations.data,
  };
}

export async function scheduleCompanyCareersAlignmentMeeting(): Promise<ScheduledAlignmentMeeting> {
  const connection = await readConnection();
  if (!connection) throw new Error("公司招聘官网尚未配置");
  const response = await requestJson<DataEnvelope<ScheduledAlignmentMeeting>>(
    connection,
    "/api/v1/cases/interviewer-alignment/schedule",
    true,
    "POST",
  );
  if (response.data.status !== "scheduled") throw new Error("招聘官网未返回已排期状态");
  return response.data;
}
