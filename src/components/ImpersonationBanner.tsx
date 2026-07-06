"use client";

import React, { useState } from "react";

interface ImpersonationBannerProps {
  isImpersonating: boolean;
  sessionInfo?: {
    sessionId: string;
    impersonatedBy: { name: string; email: string };
    impersonatingAs: { name: string; email: string; role: string; uid?: string };
  } | null;
}

export function ImpersonationBanner({
  isImpersonating,
  sessionInfo,
}: ImpersonationBannerProps) {
  const [isStopping, setIsStopping] = useState(false);

  if (!isImpersonating) {
    return null;
  }

  const handleStop = async () => {
    setIsStopping(true);
    try {
      const response = await fetch(
        "https://tcetcercd.in/api/admin/impersonate/stop",
        { method: "POST", credentials: "include" },
      );
      if (response.ok) {
        window.location.href = "https://tcetcercd.in/admin";
      } else {
        console.warn("Failed to stop impersonation");
        setIsStopping(false);
      }
    } catch {
      console.warn("Failed to stop impersonation");
      setIsStopping(false);
    }
  };

  const fullBanner = sessionInfo ? (
    <div className="flex w-full items-center gap-3">
      <span aria-hidden="true" className="shrink-0 text-base">
        ⚠
      </span>
      <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
        <span className="font-medium">
          {sessionInfo.impersonatingAs.name}
        </span>
        {sessionInfo.impersonatingAs.uid && (
          <span className="font-mono text-amber-800">
            ({sessionInfo.impersonatingAs.uid})
          </span>
        )}
        <span className="text-amber-800">
          · {sessionInfo.impersonatingAs.role} · Original session:{" "}
          {sessionInfo.impersonatedBy.name} ({sessionInfo.impersonatedBy.email})
        </span>
      </div>
      <div className="ml-auto shrink-0">
        <button
          type="button"
          disabled={isStopping}
          onClick={handleStop}
          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isStopping ? "Stopping..." : "Stop"}
        </button>
      </div>
    </div>
  ) : (
    <div className="flex w-full items-center gap-3">
      <span aria-hidden="true" className="shrink-0 text-base">
        ⚠
      </span>
      <span>Impersonating. Loading details...</span>
    </div>
  );

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[9999] border-b border-amber-400 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"
      role="alert"
    >
      {fullBanner}
    </div>
  );
}
