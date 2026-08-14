"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { verifySitePinAction, type SitePinActionState } from "@/server-actions/site-access";

const initialState: SitePinActionState = {};

export function EnterPinForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(verifySitePinAction.bind(null, next), initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Enter the PIN</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="pin" className="text-sm font-semibold">
                PIN
              </label>
              <Input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="off" autoFocus required />
            </div>

            {state.error && (
              <p role="alert" className="text-sm font-semibold text-danger">
                {state.error}
              </p>
            )}

            <Button type="submit" disabled={pending} className="mt-2">
              {pending ? "Checking…" : "Enter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
