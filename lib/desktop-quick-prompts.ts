/** Small, explicit workflow cues; publishing stays in the JD notification. */
export function recruitingQuickPrompts(context: {
  hasJd: boolean;
  jdRequested: boolean;
  progressReady: boolean;
  busy: boolean;
  viewingRecruiting: boolean;
  publishedJob: string | null;
  checkedPublication: boolean;
}): string[] {
  if (!context.progressReady) return [];
  if (context.publishedJob) {
    return !context.busy && context.checkedPublication && context.viewingRecruiting
      ? [`帮我看看 ${context.publishedJob}岗位，面试结束了多少人，还有几人的评价没齐？`]
      : [];
  }
  // The opening cue needs only this workspace's restored progress. Opening a
  // document, another task, or waiting for the recruiting site is not required.
  return context.hasJd || context.jdRequested ? [] : ["请根据飞书中的《星流科技业务介绍》，生成 高级 AI Agent 研发工程师的岗位 JD，作为可打开的文件放在工作台中。"];
}
