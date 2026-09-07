const date = (day, hour = 10) =>
  `2026-09-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00+08:00`;
const names = [
  "林然",
  "许宁",
  "苏悦",
  "陈知远",
  "周嘉言",
  "沈亦辰",
  "陆星河",
  "江雨桐",
  "顾清和",
  "程以安",
  "温书宁",
  "何景行",
  "孟予川",
  "叶思齐",
  "韩知夏",
  "唐若溪",
  "宋云舟",
  "秦书瑶",
  "方亦帆",
  "白映雪",
  "赵星野",
  "梁予安",
  "贺嘉树",
  "夏听澜",
  "郑语晨",
  "丁沐言",
  "吴知遥",
  "冯星禾",
  "邵景明",
  "彭书南",
  "许明澈",
  "林映川",
  "杜若宁",
  "季思远",
  "沈星澜",
  "罗知意",
  "袁清越",
  "田一诺",
  "钟若晴",
  "马云舒",
  "侯予墨",
  "石清扬",
  "熊晓舟",
  "顾晚晴",
  "邓望舒",
  "金亦宁",
  "蒋承宇",
  "郑安然",
  "谢芷晴",
  "任亦航",
  "潘云溪",
  "黎书言",
  "姚星辰",
  "崔以宁",
  "萧景初",
  "廖知微",
  "莫言川",
  "段清妍",
  "苏景禾",
  "陆知衡",
  "唐以棠",
  "方雨澄",
];
const schools = [
  "浙江大学 · 计算机硕士",
  "电子科技大学 · 软件工程本科",
  "华中科技大学 · 计算机本科",
  "南京大学 · 人工智能硕士",
  "同济大学 · 软件工程硕士",
  "华南理工大学 · 信息工程本科",
];
const companies = [
  "远山智能",
  "青禾科技",
  "知行实验室",
  "云际数据",
  "未央软件",
  "澄明科技",
];
const reviews = [
  "能够清晰拆解任务规划与工具执行边界，展示了失败恢复设计和线上评测记录；建议继续考察复杂协作场景。",
  "项目复盘具体，对质量和用户反馈有持续跟踪。沟通清楚，能够解释技术选择及其业务影响。",
  "基础能力扎实，能用数据支持判断；在资源约束下的方案取舍有条理，符合本轮预期。",
  "对关键问题的回答缺少可验证的项目证据，系统边界与故障处理方案不够完整，建议本轮不通过。",
];

export function seedData() {
  const jobs = [
    {
      id: "ai-agent",
      title: "AI Agent 工程师",
      department: "Agent 研发",
      location: "杭州 / 上海",
      target: 6,
      owner: "陈晓 · 研发负责人",
      priority: true,
      skills: ["TypeScript", "Agent runtime", "LLM 评测"],
      description:
        "构建面向真实工作流的 Agent 执行系统，负责工具调用、记忆、评测与可靠性。期待有生产系统经验、重视产品结果的工程师。",
      count: 30,
    },
    {
      id: "ai-product",
      title: "AI 产品经理",
      department: "产品与设计",
      location: "杭州",
      target: 2,
      owner: "周舟 · 产品负责人",
      skills: ["工作流设计", "用户研究", "数据分析"],
      description:
        "从用户工作场景出发，定义 AI 协作产品的体验、衡量方式与交付路径。",
      count: 10,
    },
    {
      id: "frontend",
      title: "前端工程师",
      department: "Agent 研发",
      location: "上海",
      target: 2,
      owner: "陈晓 · 研发负责人",
      skills: ["React", "TypeScript", "交互体验"],
      description:
        "打造高质量、多窗口、实时协作的 Agent 工作空间，关注性能与可访问性。",
      count: 8,
    },
    {
      id: "designer",
      title: "产品设计师",
      department: "产品与设计",
      location: "杭州",
      target: 1,
      owner: "顾宁 · 设计负责人",
      skills: ["交互设计", "设计系统", "原型验证"],
      description:
        "设计人和 Agent 协作的新方式，将复杂能力转化为清楚、可信的产品体验。",
      count: 7,
    },
    {
      id: "growth",
      title: "开发者增长经理",
      department: "开发者生态",
      location: "上海",
      target: 1,
      owner: "李澄 · 生态负责人",
      skills: ["开发者社区", "内容策略", "增长实验"],
      description:
        "通过开发者内容、社区和可衡量的增长实验，把产品带入真实团队。",
      count: 7,
    },
  ].map((j) => ({ ...j, publishedAt: "2026-08-18", status: "已发布" }));
  let globalIndex = 0;
  const applications = jobs.flatMap((job, jobIndex) =>
    Array.from({ length: job.count }, (_, i) => {
      const n = globalIndex++;
      // The first role has 30 applied, 24 screened, 18 entered interview,
      // 12 finished, 7 passed, 2 failed, 3 pending (each missing feedback).
      const phase =
        jobIndex === 0
          ? i < 12
            ? "finished"
            : i < 18
              ? "interviewing"
              : i < 24
                ? "screened"
                : i < 28
                  ? "applied"
                  : "rejected"
          : i < 4
            ? "finished"
            : i < 6
              ? "interviewing"
              : i < 7
                ? "screened"
                : "applied";
      const hasInterviews = ["finished", "interviewing"].includes(phase);
      const screened = hasInterviews || phase === "screened";
      const pending = phase === "finished" && i < (jobIndex === 0 ? 3 : 1);
      const decision =
        phase === "finished" && !pending
          ? i >= (jobIndex === 0 ? 10 : 3)
            ? "failed"
            : "passed"
          : null;
      const interviews = hasInterviews
        ? ["专业面试", "团队面试"].map((name, r) => {
            const ended = phase === "finished" || r === 0;
            const missing =
              (pending && (r === 1 || i === 1)) ||
              (phase === "interviewing" && i % 2 === 0 && r === 0);
            const draft = missing && i === 2;
            return {
              id: `round-${r + 1}`,
              name,
              interviewer: r === 0 ? "Mark" : "TIM",
              scheduledAt: date(
                phase === "interviewing" && r === 1 ? 9 : 2 + r + (i % 3),
                14,
              ),
              endedAt: ended ? date(2 + r + (i % 3), 15) : null,
              review:
                ended && (!missing || draft)
                  ? {
                      status: draft ? "draft" : "submitted",
                      score: decision === "failed" ? 2 : 4,
                      opinion: draft
                        ? "项目经验与岗位匹配，待补充面试结论。"
                        : reviews[decision === "failed" ? 3 : (i + r) % 3],
                      conclusion: draft
                        ? "undecided"
                        : decision === "failed"
                          ? "no"
                          : "yes",
                      updatedAt: date(3 + r + (i % 3), 16),
                    }
                  : null,
            };
          })
        : [];
      return {
        id: `NF-${String(n + 1001)}`,
        jobId: job.id,
        name: names[n],
        school: schools[n % schools.length],
        company: companies[n % companies.length],
        years: 3 + (n % 7),
        source: ["官网投递", "内部推荐", "人才社区"][n % 3],
        skills: job.skills,
        summary: `${3 + (n % 7)} 年${job.department}相关经验。最近在${companies[n % companies.length]}负责${job.title}相关工作，重视跨团队沟通与交付质量。`,
        projects: [
          jobIndex === 0
            ? "企业知识 Agent：负责检索、工具编排与失败恢复，构建离线评测集并推动灰度上线。"
            : `${job.skills[0]}实践：从需求调研到上线复盘，独立负责一个完整版本。`,
          jobIndex === 0
            ? `多工具协作平台：接入 ${4 + (n % 5)} 类工具，建立执行日志、权限边界和人工确认机制。`
            : "跨职能协作：与研发和业务团队共建验收标准，跟踪真实用户反馈。",
        ],
        appliedAt: "2026-08-22T10:00:00+08:00",
        screening: screened
          ? "passed"
          : phase === "rejected"
            ? "rejected"
            : "pending",
        screenedAt: screened ? "2026-08-26T10:00:00+08:00" : null,
        interviews,
        decision,
        decisionReason: decision
          ? decision === "passed"
            ? "综合面试证据符合岗位要求。"
            : "当前经验与岗位要求存在差距。"
          : "",
        history: [
          { at: "2026-08-22T10:00:00+08:00", text: "收到简历投递" },
          ...(screened
            ? [{ at: "2026-08-26T10:00:00+08:00", text: "简历筛选通过" }]
            : phase === "rejected"
              ? [{ at: "2026-08-26T10:00:00+08:00", text: "简历筛选未通过" }]
              : []),
          ...interviews.map((r) => ({
            at: r.endedAt ?? r.scheduledAt,
            text: `${r.name} · ${r.interviewer} · ${r.endedAt ? "已结束" : "已安排，尚未开始"}`,
          })),
          ...(decision
            ? [
                {
                  at: date(7, 9),
                  text: decision === "passed" ? "面试通过" : "面试失败",
                },
              ]
            : []),
        ],
      };
    }),
  );
  return {
    schemaVersion: 1,
    jobs: jobs.map((job) => {
      const result = { ...job };
      delete result.count;
      return result;
    }),
    applications,
  };
}
