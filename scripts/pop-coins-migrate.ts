import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL || "");

const statements = [
  "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS coin_balance integer NOT NULL DEFAULT 500",
  "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS total_earned integer NOT NULL DEFAULT 0",
  "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS total_spent integer NOT NULL DEFAULT 0",
  "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS total_won integer NOT NULL DEFAULT 0",
  "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS last_daily_claim_at timestamp with time zone",
  "ALTER TABLE wallets ADD COLUMN IF NOT EXISTS login_streak integer NOT NULL DEFAULT 0",
  "ALTER TABLE wallets DROP COLUMN IF EXISTS cash_balance",
  "ALTER TABLE wallets DROP COLUMN IF EXISTS bonus_balance",
  "ALTER TABLE wallets DROP COLUMN IF EXISTS total_deposited",
  "ALTER TABLE wallets DROP COLUMN IF EXISTS total_withdrawn",
  "ALTER TABLE wallets DROP COLUMN IF EXISTS total_winnings",
  "ALTER TABLE transactions ALTER COLUMN amount TYPE integer USING ROUND(amount)::integer",
  "ALTER TABLE transactions ALTER COLUMN status SET DEFAULT 'completed'",
  "ALTER TABLE transactions DROP COLUMN IF EXISTS gateway",
  "ALTER TABLE transactions DROP COLUMN IF EXISTS gateway_ref",
  "ALTER TABLE contests ALTER COLUMN entry_fee TYPE integer USING ROUND(entry_fee)::integer",
  "ALTER TABLE contests ALTER COLUMN prize_pool TYPE integer USING ROUND(prize_pool)::integer",
  "UPDATE wallets SET coin_balance = 500 WHERE coin_balance = 0",
];

async function run() {
  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
      console.log("OK:", stmt.substring(0, 70));
    } catch (e: any) {
      console.log("ERR:", stmt.substring(0, 70), "-", e.message);
    }
  }
  await sql.end();
  console.log("Migration complete!");
}

run();
