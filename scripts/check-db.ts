import { getDb } from '../packages/db/src/index';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  const tournaments = await db.execute(sql`SELECT count(*) as count FROM tournaments`);
  const matchesCount = await db.execute(sql`SELECT count(*) as count FROM matches`);
  const players = await db.execute(sql`SELECT count(*) as count FROM players`);
  const usersCount = await db.execute(sql`SELECT count(*) as count FROM users`);
  const contests = await db.execute(sql`SELECT count(*) as count FROM contests`);

  console.log('=== DATABASE COUNTS ===');
  console.log('Tournaments:', tournaments[0]?.count);
  console.log('Matches:', matchesCount[0]?.count);
  console.log('Players:', players[0]?.count);
  console.log('Users:', usersCount[0]?.count);
  console.log('Contests:', contests[0]?.count);

  const tournamentNames = await db.execute(sql`SELECT name, is_visible FROM tournaments LIMIT 10`);
  console.log('\n=== TOURNAMENTS ===');
  for (const t of tournamentNames) {
    console.log('  ' + (t as any).name + ' (visible: ' + (t as any).is_visible + ')');
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
