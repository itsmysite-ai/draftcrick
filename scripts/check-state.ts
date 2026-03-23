#!/usr/bin/env npx tsx
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:Dreamproject@34.57.117.132:5432/draftplay";

async function main() {
  const sql = postgres(DB_URL);
  const c = await sql`SELECT (SELECT count(*) FROM tournaments) as t, (SELECT count(*) FROM matches) as m, (SELECT count(*) FROM players) as p`;
  console.log("Current DB:", c[0]);

  const t = await sql`SELECT name, sport FROM tournaments`;
  t.forEach((r: any) => console.log("  Tournament:", r.name));

  const m = await sql`SELECT team_home, team_away, status FROM matches LIMIT 6`;
  m.forEach((r: any) => console.log("  Match:", r.team_home, "vs", r.team_away, "(" + r.status + ")"));

  const p = await sql`SELECT name, team, nationality FROM players LIMIT 5`;
  p.forEach((r: any) => console.log("  Player:", r.name, "-", r.team, "-", r.nationality));

  await sql.end();
}

main().catch(console.error);
