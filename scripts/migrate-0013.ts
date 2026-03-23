import { getDb } from "../packages/db/src/index";
import { sql } from "drizzle-orm";

async function main() {
  const db = getDb();

  const result = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'payment_provider'`
  );

  const rows = Array.isArray(result) ? result : (result as any).rows ?? [];
  if (rows.length > 0) {
    console.log("Migration 0013 already applied — payment_provider column exists.");
    process.exit(0);
  }

  console.log("Applying migration 0013_payment_provider...");
  await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN payment_provider TEXT NOT NULL DEFAULT 'razorpay'`);
  await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN revenuecat_customer_id TEXT`);
  await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN apple_original_transaction_id TEXT`);
  await db.execute(sql`ALTER TABLE subscriptions ADD COLUMN purchase_platform TEXT`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(payment_provider)`);
  console.log("Migration 0013 applied successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
