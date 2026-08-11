"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clearAdminSession, createAdminSession, verifyPassword } from "@/lib/auth";

export interface LoginActionState {
  error?: string;
}

export async function loginAction(_prevState: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Username and password are required." };
  }

  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    // Deliberately identical message for "no such admin" and "wrong
    // password" — don't leak which one it was.
    return { error: "Invalid username or password." };
  }

  await createAdminSession({ adminId: admin.id, username: admin.username });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/login");
}
