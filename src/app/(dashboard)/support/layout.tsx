import { notFound } from "next/navigation";
import { SUPPORT_ENABLED } from "@/lib/support/feature-flag";
import { validateChatwootConfig } from "@/lib/chatwoot/config";

if (SUPPORT_ENABLED) {
  validateChatwootConfig();
}

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  if (!SUPPORT_ENABLED) notFound();
  return <div>{children}</div>;
}
