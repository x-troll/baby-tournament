// Admin ("Daddy") auth. Hand-rolled rather than NextAuth/Auth.js — v5 is
// still in beta on npm as of this build (see PLAN.md Phase 1 note), and a
// single credentials-login-plus-session-cookie is small enough that a
// whole framework isn't buying much. Reuses the same jose-signed-cookie
// approach planned for baby sessions (Phase 5), for one consistent
// pattern instead of two.
// Deliberately no `import "server-only"` here: this module is also
// imported directly by standalone scripts (scripts/ensure-admin-seed.ts,
// and the Phase 8 rehearsal seed), which run outside Next's build
// pipeline where `server-only`'s always-throw guard would break them.
// Nothing here is ever imported from a client component.
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Admin } from "@/generated/prisma/client";

const COOKIE_NAME = "playtime_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12h — comfortably covers one bar night

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — required to sign/verify admin sessions");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface AdminSessionPayload {
  adminId: string;
  username: string;
}

export async function createAdminSession(payload: AdminSessionPayload): Promise<void> {
  const token = await new SignJWT({ adminId: payload.adminId, username: payload.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

async function getAdminSessionPayload(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.adminId !== "string" || typeof payload.username !== "string") return null;
    return { adminId: payload.adminId, username: payload.username };
  } catch {
    return null; // expired, tampered, or signed with an old secret
  }
}

/** Returns the authenticated Admin row, or null. Does not redirect — callers decide. */
export async function getCurrentAdmin(): Promise<Admin | null> {
  const session = await getAdminSessionPayload();
  if (!session) return null;
  return prisma.admin.findUnique({ where: { id: session.adminId } });
}

/** For pages/layouts that require auth — redirects to the login screen otherwise. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  return admin;
}
