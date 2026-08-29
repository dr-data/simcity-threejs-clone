import { hashPassword, generateSalt } from '../worker/src/auth.js';
import { readFileSync, writeFileSync } from 'fs';

/**
 * Generates SQL to seed the first admin user.
 * Usage: node scripts/seed-admin.js [username] [password]
 * Then: wrangler d1 execute classroom-simcity --file=worker/seed-output.sql
 */
const username = process.argv[2] || 'admin';
const password = process.argv[3] || 'classroom123';
const email = process.argv[4] || 'teacher@school.edu';

const salt = generateSalt();
const hash = await hashPassword(password, salt);

const sql = `
INSERT OR IGNORE INTO users (username, email, password_hash, password_salt, is_admin)
VALUES ('${username}', '${email}', '${hash}', '${salt}', 1);

INSERT OR IGNORE INTO player_stats (user_id)
SELECT id FROM users WHERE username = '${username}';
`;

writeFileSync('worker/seed-output.sql', sql.trim());
console.log(`Generated worker/seed-output.sql for admin user "${username}"`);
console.log('Run: wrangler d1 execute classroom-simcity --file=worker/seed-output.sql');
