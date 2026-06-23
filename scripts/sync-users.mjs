#!/usr/bin/env node

/**
 * sync-users.mjs
 *
 * One-time migration script that reads all active users from COE Main's
 * database and upserts them into the Project Dashboard database.
 *
 * Requirements:
 *   - COE_MAIN_DATABASE_URL env var (read-only access to COE Main MySQL)
 *   - DATABASE_URL env var (dashboard's own database, already configured)
 *
 * Usage:
 *   COE_MAIN_DATABASE_URL="mysql://user:pass@host:3306/coe_main" \
 *     node scripts/sync-users.mjs
 *
 * Idempotent: safe to run multiple times. Uses upsert by email.
 *
 * Role mapping:
 *   STUDENT          -> STUDENT
 *   FACULTY          -> TEACHER
 *   ADMIN            -> ADMIN
 *   INDUSTRY_PARTNER -> skipped (no equivalent dashboard role)
 *
 * Field mapping:
 *   email        -> email       (key, normalized)
 *   name         -> name
 *   role         -> role        (mapped)
 *   uid          -> uid
 *   status       -> isActive derived (status=ACTIVE)
 *
 * Logs:
 *   Processed: X
 *   Created:   X
 *   Updated:   X
 *   Skipped:   X
 *   Failed:    X
 */

import mysql from "mysql2/promise";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLE_MAP = {
  STUDENT: "STUDENT",
  FACULTY: "TEACHER",
  ADMIN: "ADMIN",
};

function normalizeEmail(email) {
  return email.toLowerCase().trim();
}

function defaultName(email) {
  const localPart = email.split("@")[0];
  return localPart?.trim() || email;
}

async function main() {
  const coeDbUrl = process.env.COE_MAIN_DATABASE_URL;
  if (!coeDbUrl) {
    console.error("FATAL: COE_MAIN_DATABASE_URL environment variable is required.");
    console.error("Example:");
    console.error('  COE_MAIN_DATABASE_URL="mysql://user:pass@host:3306/coe_main" node scripts/sync-users.mjs');
    process.exit(1);
  }

  console.log("[sync-users] Connecting to COE Main database...");
  const coeConn = await mysql.createConnection(coeDbUrl);
  console.log("[sync-users] Connected.\n");

  // Read all active, verified, non-rejected users from COE Main
  const [rows] = await coeConn.execute(
    `SELECT email, name, role, uid, status
     FROM users
     WHERE (status = 'ACTIVE')
       AND (isVerified = 1 OR role IN ('FACULTY', 'ADMIN'))
     ORDER BY email ASC`
  );
  await coeConn.end();

  console.log(`[sync-users] Found ${rows.length} active users in COE Main.\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const coeUser of rows) {
    const email = normalizeEmail(coeUser.email);
    const mappedRole = ROLE_MAP[coeUser.role];

    if (!mappedRole) {
      console.log(`  SKIP  ${email} (unsupported role: ${coeUser.role})`);
      skipped++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { email },
          select: {
            id: true, name: true, role: true, isActive: true, uid: true,
          },
        });

        if (existing) {
          const updateData = {};
          const newName = coeUser.name?.trim() || defaultName(email);
          if (existing.name !== newName) updateData.name = newName;
          if (existing.role !== mappedRole) updateData.role = mappedRole;
          if (coeUser.uid && existing.uid !== coeUser.uid) updateData.uid = coeUser.uid;
          updateData.isActive = coeUser.status === "ACTIVE";

          if (Object.keys(updateData).length > 0) {
            await tx.user.update({ where: { id: existing.id }, data: updateData });
          }
          updated++;
        } else {
          await tx.user.create({
            data: {
              name: coeUser.name?.trim() || defaultName(email),
              email,
              role: mappedRole,
              isActive: coeUser.status === "ACTIVE",
              passwordHash: "",
              uid: coeUser.uid || null,
            },
          });
          created++;
        }
      });

      process.stdout.write(".");
    } catch (err) {
      console.error(`\n  FAIL  ${email}: ${err.message}`);
      failed++;
    }
  }

  await prisma.$disconnect();

  console.log("\n\n=== Migration Summary ===");
  console.log(`  Processed: ${rows.length}`);
  console.log(`  Created:   ${created}`);
  console.log(`  Updated:   ${updated}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Failed:    ${failed}`);
  console.log("========================\n");

  if (failed > 0) {
    console.warn("Some users failed to sync. Check the error messages above.");
    process.exit(1);
  }

  console.log("Migration complete.");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
