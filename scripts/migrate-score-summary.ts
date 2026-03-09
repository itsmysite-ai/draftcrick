import { sql } from "drizzle-orm";
import { getDb } from "../packages/db/src/index";

async function main() {
  const db = getDb();
  await db.execute(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_summary text`);
  console.log("Done: score_summary column added");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
