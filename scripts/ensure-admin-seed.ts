// Idempotent: seeds exactly one Daddy from ADMIN_USERNAME/ADMIN_PASSWORD on
// the very first run, then no-ops on every subsequent run (including
// every future Heroku `release` phase) — checked by "does *any* admin
// exist yet", not by matching the username, so it never silently resets a
// password an admin has since changed from the panel.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { seedFirstAdminFromEnv } from "../src/lib/seed-admin";

async function main() {
  const existingCount = await prisma.admin.count();
  if (existingCount > 0) {
    console.log(`[ensure-admin-seed] ${existingCount} admin(s) already exist — skipping.`);
    return;
  }

  const admin = await seedFirstAdminFromEnv();
  console.log(`[ensure-admin-seed] Created first admin: ${admin.username} (id ${admin.id}).`);
  console.log("[ensure-admin-seed] Change this password from the admin panel after logging in.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
