/**
 * Wallet API Tests — Authenticated tRPC endpoint validation
 *
 * Tests wallet router: getBalance, deposit, withdraw, getTransactions.
 * Requires Firebase Auth Emulator + API server running.
 *
 * Run: npx tsx tests/e2e/api/wallet.api.test.ts
 */

import {
  createTestUser,
  clearEmulatorAccounts,
  trpcAuthQuery,
  trpcAuthMutate,
  unwrap,
  assert,
  expectTRPCError,
  test,
  describe,
  runTests,
} from "../helpers/api-auth";

describe("Wallet API", () => {
  const EMAIL = "wallet-test@draftplay.test";
  const PASSWORD = "TestPass123!";
  let token: string;
  let startBalance: number;

  test("wallet.getBalance returns balance object", async () => {
    await clearEmulatorAccounts();
    const user = await createTestUser(EMAIL, PASSWORD);
    token = user.idToken;

    const res = await trpcAuthQuery("wallet.getBalance", undefined, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(typeof data?.cashBalance === "number", "Expected cashBalance number");
    assert(typeof data?.bonusBalance === "number", "Expected bonusBalance number");
    assert(typeof data?.totalBalance === "number", "Expected totalBalance number");
    startBalance = data.cashBalance;
    console.log(`    starting balance: ${startBalance}`);
  });

  test("wallet.deposit 500 increases balance", async () => {
    const res = await trpcAuthMutate("wallet.deposit", { amount: 500 }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.status === "completed", "Expected completed");
    assert(typeof data?.transactionId === "string", "Expected transactionId");

    // Verify balance increased by 500
    const bal = unwrap(await trpcAuthQuery("wallet.getBalance", undefined, token));
    assert(bal?.cashBalance === startBalance + 500, `Expected ${startBalance + 500}, got ${bal?.cashBalance}`);
  });

  test("wallet.deposit 200 more increases balance by 200", async () => {
    const res = await trpcAuthMutate("wallet.deposit", { amount: 200 }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);

    const bal = unwrap(await trpcAuthQuery("wallet.getBalance", undefined, token));
    assert(bal?.cashBalance === startBalance + 700, `Expected ${startBalance + 700}, got ${bal?.cashBalance}`);
  });

  test("wallet.getTransactions returns deposits", async () => {
    const res = await trpcAuthQuery("wallet.getTransactions", {}, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data), "Expected array");
    assert(data.length >= 2, `Expected at least 2 transactions, got ${data.length}`);
  });

  test("wallet.getTransactions with type filter", async () => {
    const res = await trpcAuthQuery("wallet.getTransactions", { type: "deposit" }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data), "Expected array");
    for (const t of data) {
      assert(t.type === "deposit", `Expected deposit, got ${t.type}`);
    }
  });

  test("wallet.withdraw 100 decreases balance by 100", async () => {
    const res = await trpcAuthMutate("wallet.withdraw", { amount: 100 }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.status === "completed", "Expected completed");

    const bal = unwrap(await trpcAuthQuery("wallet.getBalance", undefined, token));
    assert(bal?.cashBalance === startBalance + 600, `Expected ${startBalance + 600}, got ${bal?.cashBalance}`);
  });

  test("wallet.withdraw exceeding balance returns BAD_REQUEST", async () => {
    const res = await trpcAuthMutate("wallet.withdraw", { amount: 999999 }, token);
    expectTRPCError(res, "BAD_REQUEST");
  });

  test("wallet.getBalance unauthenticated returns UNAUTHORIZED", async () => {
    const res = await trpcAuthQuery("wallet.getBalance");
    expectTRPCError(res, "UNAUTHORIZED");
  });
});

runTests("Wallet API Tests");
