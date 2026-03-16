/**
 * Helper script to set a user's role to admin in the database.
 * Usage: npx tsx tests/e2e/helpers/set-admin-role.ts <email>
 */
import { getDb } from "../../../packages/db/src/index";
import { users } from "../../../packages/db/src/schema/users";
import { eq } from "drizzle-orm";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx tests/e2e/helpers/set-admin-role.ts <email>");
  process.exit(1);
}

async function main() {
  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.email, email))
    .returning({ id: users.id, role: users.role, email: users.email });

  if (updated) {
    console.log(`Set role=admin for ${updated.email} (id: ${updated.id})`);
  } else {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
