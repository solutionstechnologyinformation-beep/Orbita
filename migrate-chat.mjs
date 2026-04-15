import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [cols] = await conn.execute('DESCRIBE chat_messages');
const fields = cols.map(r => r.Field);
console.log('Current fields:', fields);

if (!fields.includes('crsId')) {
  console.log('Adding crsId column...');
  await conn.execute('ALTER TABLE chat_messages ADD COLUMN crsId INT NULL AFTER userId');
  await conn.execute('UPDATE chat_messages SET crsId = projectId WHERE projectId IS NOT NULL');
  console.log('crsId column added and data migrated from projectId');
} else {
  console.log('crsId already exists — no migration needed');
}

await conn.end();
console.log('Done.');
