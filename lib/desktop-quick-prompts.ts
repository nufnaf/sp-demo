/** Small, explicit workflow cues; publishing stays in the JD notification. */
export function recruitingQuickPrompts(context: {
  hasJd: boolean;
  busy: boolean;
  viewingRecruiting: boolean;
  publishedJob: string | null;
  checkedPublication: boolean;
}): string[] {
  if (context.busy || !context.checkedPublication) return [];
  if (context.publishedJob) {
    return context.viewingRecruiting
      ? [`帮我看看 ${context.publishedJob}岗位，面试结束了多少人，还有几人的评价没齐？`]
      : [];
  }
  return context.hasJd ? [] : ["请根据飞书中的《星流科技业务介绍》，生成 高级 AI Agent 研发工程师的岗位 JD，作为可打开的文件放在工作台中。"];
}
