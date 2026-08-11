// Idempotent: seeds exactly one Daddy from ADMIN_USERNAME/ADMIN_PASSWORD on
// the very first run, then no-ops on every subsequent run (including
// every future Heroku `release` phase) — checked by "does *any* admin
// exist yet", not by matching the username, so it never silently resets a
// password an admin has since changed from the panel.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth";
import { shortId } from "../src/lib/short-id";

async function main() {
  const existingCount = await prisma.admin.count();
  if (existingCount > 0) {
    console.log(`[ensure-admin-seed] ${existingCount} admin(s) already exist — skipping.`);
    return;
  }

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "[ensure-admin-seed] No admins exist yet, and ADMIN_USERNAME/ADMIN_PASSWORD are not both set — cannot seed the first Daddy.",
    );
  }

  const passwordHash = await hashPassword(password);
  const admin = await prisma.admin.create({
    data: { username, passwordHash, name: "Daddy", adminLinkToken: shortId() },
  });
  console.log(`[ensure-admin-seed] Created first admin: ${admin.username} (id ${admin.id}).`);
  console.log("[ensure-admin-seed] Change this password from the admin panel after logging in.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
