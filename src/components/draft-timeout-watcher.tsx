"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { processDraftTimeoutsAction } from "@/app/actions/captain-draft";

export function DraftTimeoutWatcher({
  tournamentId,
  enabled,
}: {
  tournamentId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const tick = () => {
      startTransition(async () => {
        await processDraftTimeoutsAction(tournamentId);
        if (!stopped) router.refresh();
      });
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [enabled, router, tournamentId]);

  return null;
}

