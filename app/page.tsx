import { Suspense } from "react";
import { PresentationDesktop } from "@/components/PresentationDesktop";
import { I18nProvider } from "@/hooks/useI18n";

export default function Home() {
  return (
    <Suspense>
      <I18nProvider>
        <PresentationDesktop />
      </I18nProvider>
    </Suspense>
  );
}
