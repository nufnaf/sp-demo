import { presentationCwd } from "@/lib/presentation-runtime";
export const dynamic = "force-dynamic";
import { FeishuStartup } from "@/components/FeishuStartup";
import { Suspense } from "react";
import { AgentDesktop } from "@/components/AgentDesktop";
import { I18nProvider } from "@/hooks/useI18n";

export default function Home() {
  const cwd = presentationCwd();
  const desktop = <AgentDesktop presentationCwd={cwd} />;
  return (
    <Suspense>
      <I18nProvider>
        {cwd ? <FeishuStartup>{desktop}</FeishuStartup> : desktop}
      </I18nProvider>
    </Suspense>
  );
}
