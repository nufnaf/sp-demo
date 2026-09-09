export interface JdArtifact {
  cwd: string;
  filePath: string;
  sessionId: string;
  taskTitle: string;
}

export interface PublishedRecruitingJob {
  id: string;
  draft: string;
  title: string;
  location: string;
  department: string;
  headcount: number;
  owner: string;
  publishedAt: string;
  candidateCount: number;
  url: string;
}

// Deliberate scenario trigger, not an inference/insight engine. Only the local
// JD document being viewed can offer this demo action.
export function isJdDemoArtifact(artifact: JdArtifact): boolean {
  return /\.(html?|md|txt)$/i.test(artifact.filePath)
    && /(?:\bjd\b|职位描述|岗位描述|招聘简章)/i.test(`${artifact.filePath.replaceAll('_', '-')} ${artifact.taskTitle}`);
}

export function publicationPrompt(url: string, title: string, filePath: string): string {
  return `用户已在 JD 成果通知中点击“发布岗位”，授权将“${title}”发布到内部招聘系统，无需再次确认。立即调用 browser_task，参数如下：\n${JSON.stringify({ url, task: "发布这份 JD，通过网页填写、提交并核对保存结果。", jd_file: filePath })}\n工具会读取该文件并把完整正文交给浏览器 Agent；不需要你读取、复述或重写 JD。等待结果后简短汇总。不要访问 BOSS，不要使用业务 API 或修改业务数据文件。`;
}
