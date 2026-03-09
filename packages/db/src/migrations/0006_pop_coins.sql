-- Pop Coins: convert real-money wallet to virtual currency

-- Wallets: add new integer columns
ALTER TABLE "wallets" ADD COLUMN "coin_balance" integer NOT NULL DEFAULT 500;
ALTER TABLE "wallets" ADD COLUMN "total_earned" integer NOT NULL DEFAULT 0;
ALTER TABLE "wallets" ADD COLUMN "total_spent" integer NOT NULL DEFAULT 0;
ALTER TABLE "wallets" ADD COLUMN "total_won" integer NOT NULL DEFAULT 0;
ALTER TABLE "wallets" ADD COLUMN "last_daily_claim_at" timestamp with time zone;
ALTER TABLE "wallets" ADD COLUMN "login_streak" integer NOT NULL DEFAULT 0;

-- Wallets: drop old real-money columns
ALTER TABLE "wallets" DROP COLUMN IF EXISTS "cash_balance";
ALTER TABLE "wallets" DROP COLUMN IF EXISTS "bonus_balance";
ALTER TABLE "wallets" DROP COLUMN IF EXISTS "total_deposited";
ALTER TABLE "wallets" DROP COLUMN IF EXISTS "total_withdrawn";
ALTER TABLE "wallets" DROP COLUMN IF EXISTS "total_winnings";

-- Transactions: convert amount from decimal to integer, drop gateway columns
ALTER TABLE "transactions" ALTER COLUMN "amount" TYPE integer USING ROUND(amount)::integer;
ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'completed';
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "gateway";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "gateway_ref";

-- Contests: convert entry_fee and prize_pool from decimal to integer
ALTER TABLE "contests" ALTER COLUMN "entry_fee" TYPE integer USING ROUND(entry_fee)::integer;
ALTER TABLE "contests" ALTER COLUMN "prize_pool" TYPE integer USING ROUND(prize_pool)::integer;

-- Give existing users 500 signup coins
UPDATE "wallets" SET "coin_balance" = 500 WHERE "coin_balance" = 0;
