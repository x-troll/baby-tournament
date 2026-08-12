"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loginAction, type LoginActionState } from "@/server-actions/auth";

const initialState: LoginActionState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Daddy sign-in</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="username" className="text-sm font-semibold">
                Username
              </label>
              <Input id="username" name="username" type="text" autoComplete="username" required />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-semibold">
                Password
              </label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>

            {state.error && (
              <p role="alert" className="text-sm font-semibold text-danger">
                {state.error}
              </p>
            )}

            <Button type="submit" disabled={pending} className="mt-2">
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
