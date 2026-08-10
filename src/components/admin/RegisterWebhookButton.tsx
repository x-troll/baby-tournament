"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { registerWebhookAction } from "@/server-actions/telegram-admin";

export function RegisterWebhookButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await registerWebhookAction();
            setMessage(result.message);
          })
        }
      >
        {isPending ? "Registering…" : "Register Telegram webhook"}
      </Button>
      {message && (
        <p role="status" className="text-xs text-foreground-muted">
          {message}
        </p>
      )}
    </div>
  );
}
