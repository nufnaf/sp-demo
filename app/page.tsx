import { Suspense } from "react";
import { AgentDesktop } from "@/components/AgentDesktop";
import { I18nProvider } from "@/hooks/useI18n";

export default function Home() {
  return (
    <Suspense>
      <I18nProvider>
        <AgentDesktop />
      </I18nProvider>
    </Suspense>
  );
}
