/**
 * Database bootstrap.
 *
 *   npm run db:setup          create schema, seed reference data, create admin
 *   npm run db:reset          drop the database first, then do all of the above
 *
 * Reads connection details from server/.env.
 */
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'creative_engine',
};

const shouldReset = process.argv.includes('--reset');
const skipPrompt = process.argv.includes('--yes');

/**
 * Split a .sql file into executable statements.
 * Handles single/double quotes, backticks, line comments and block comments
 * so that semicolons inside strings do not split a statement.
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];
    const prev = sql[i - 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      else continue;
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') { inBlockComment = false; i += 1; }
      continue;
    }
    if (!inSingle && !inDouble && !inBacktick) {
      if (char === '-' && next === '-') { inLineComment = true; continue; }
      if (char === '/' && next === '*') { inBlockComment = true; i += 1; continue; }
      if (char === '#') { inLineComment = true; continue; }
    }

    if (char === "'" && prev !== '\\' && !inDouble && !inBacktick) inSingle = !inSingle;
    else if (char === '"' && prev !== '\\' && !inSingle && !inBacktick) inDouble = !inDouble;
    else if (char === '`' && !inSingle && !inDouble) inBacktick = !inBacktick;

    if (char === ';' && !inSingle && !inDouble && !inBacktick) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }
    current += char;
  }
  const last = current.trim();
  if (last) statements.push(last);
  return statements;
}

async function runSqlFile(connection, filePath, label) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const statements = splitStatements(sql);
  let done = 0;
  let skipped = 0;

  for (const statement of statements) {
    try {
      await connection.query(statement);
      done += 1;
    } catch (err) {
      // Re-running setup is normal; ignore "already exists" style errors.
      const benign = [
        'ER_DUP_KEYNAME', 'ER_DUP_ENTRY', 'ER_TABLE_EXISTS_ERROR',
        'ER_DUP_FIELDNAME', 'ER_FK_DUP_NAME', 'ER_CANT_DROP_FIELD_OR_KEY',
      ];
      if (benign.includes(err.code)) {
        skipped += 1;
        continue;
      }
      console.error(`\n  Failed while running ${label}:`);
      console.error(`  ${err.code}: ${err.sqlMessage || err.message}`);
      console.error(`  Statement: ${statement.slice(0, 200)}...\n`);
      throw err;
    }
  }
  console.log(`  ${label}: ${done} statement(s) executed${skipped ? `, ${skipped} skipped (already present)` : ''}`);
}

async function promptAdmin() {
  if (skipPrompt) {
    return {
      firstName: 'Admin', lastName: 'User',
      email: 'admin@creativeengine.co.tz', password: 'ChangeMe123!',
    };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n  Create the first administrator account');
  console.log('  ─────────────────────────────────────');

  const firstName = (await rl.question('  First name [Admin]: ')).trim() || 'Admin';
  const lastName = (await rl.question('  Last name [User]: ')).trim() || 'User';
  let email = '';
  while (!email.includes('@')) {
    email = (await rl.question('  Email: ')).trim().toLowerCase();
    if (!email.includes('@')) console.log('  Please enter a valid email address.');
  }
  let password = '';
  while (password.length < 8) {
    password = (await rl.question('  Password (min 8 characters): ')).trim();
    if (password.length < 8) console.log('  Password must be at least 8 characters.');
  }
  rl.close();
  return { firstName, lastName, email, password };
}

async function main() {
  console.log('\n  Creative Engine — database setup');
  console.log('  ════════════════════════════════\n');

  let root;
  try {
    root = await mysql.createConnection({
      host: DB.host, port: DB.port, user: DB.user, password: DB.password,
      multipleStatements: false,
    });
  } catch (err) {
    console.error('  Could not connect to MySQL.');
    console.error(`  ${err.message}\n`);
    console.error('  Check that MySQL is running and that server/.env has the right');
    console.error('  DB_HOST, DB_PORT, DB_USER and DB_PASSWORD values.\n');
    process.exit(1);
  }

  if (shouldReset) {
    console.log(`  Dropping database "${DB.database}" ...`);
    await root.query(`DROP DATABASE IF EXISTS \`${DB.database}\``);
  }

  await root.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB.database}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`  Database "${DB.database}" ready`);
  await root.end();

  const db = await mysql.createConnection({ ...DB, multipleStatements: false });

  console.log('\n  Creating tables ...');
  await runSqlFile(db, path.join(__dirname, 'schema.sql'), 'schema.sql');

  console.log('\n  Seeding reference data ...');
  await runSqlFile(db, path.join(__dirname, 'seed.sql'), 'seed.sql');

  // --------------------------------------------------------- admin user
  const [existing] = await db.query(
    'SELECT u.id, u.email FROM users u JOIN roles r ON r.id = u.role_id WHERE r.slug = ? LIMIT 1',
    ['admin']
  );

  if (existing.length > 0) {
    console.log(`\n  An administrator already exists: ${existing[0].email}`);
    console.log('  Skipping admin creation.');
  } else {
    const admin = await promptAdmin();
    const hash = await bcrypt.hash(admin.password, 12);
    const [roleRows] = await db.query("SELECT id FROM roles WHERE slug = 'admin'");

    await db.query(
      `INSERT INTO users (role_id, first_name, last_name, email, password_hash, job_title,
                          division, is_active, email_verified_at)
       VALUES (?,?,?,?,?,?,?,1,NOW())`,
      [roleRows[0].id, admin.firstName, admin.lastName, admin.email, hash,
       'Founder / Creative Director', 'management']
    );
    console.log(`\n  Administrator created: ${admin.email}`);
    if (skipPrompt) {
      console.log('  Password: ChangeMe123!  — change this immediately after first sign-in.');
    }
  }

  // ------------------------------------------------- default AI assistant
  const [assistants] = await db.query('SELECT id FROM ai_assistants LIMIT 1');
  if (assistants.length === 0) {
    await db.query(
      `INSERT INTO ai_assistants
         (organisation_id, name, slug, description, greeting, system_prompt,
          channels, fallback_message, capture_leads, require_kb_grounding,
          theme_color, is_active)
       VALUES (NULL,?,?,?,?,?,?,?,1,1,?,0)`,
      [
        'Creative Engine Assistant', 'creative-engine-assistant',
        'The assistant on our own website. It answers questions about our services and captures enquiries.',
        'Hello. I can tell you about our services, pricing and how we work. What would you like to know?',
        'You are the customer assistant for Creative Engine, an integrated creative, digital, AI, events and production company based in Dar es Salaam, Tanzania.',
        JSON.stringify(['website']),
        'I do not have that detail to hand. Let me pass you to a colleague who can answer properly — could you share your name and the best number to reach you?',
        '#E85D2A',
      ]
    );
    console.log('  Default AI assistant created (inactive until you add an API key)');
  }

  // ----------------------------------------------------- default folders
  const [folders] = await db.query('SELECT id FROM media_folders LIMIT 1');
  if (folders.length === 0) {
    for (const name of ['Brand Assets', 'Client Work', 'Website', 'Equipment', 'Print Artwork', 'Mockups', 'Team']) {
      await db.query('INSERT INTO media_folders (name, path) VALUES (?, ?)', [name, `/${name}`]);
    }
    console.log('  Default media folders created');
  }

  const [summary] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM divisions) AS divisions,
       (SELECT COUNT(*) FROM services) AS services,
       (SELECT COUNT(*) FROM packages) AS packages,
       (SELECT COUNT(*) FROM equipment) AS equipment,
       (SELECT COUNT(*) FROM print_products) AS print_products,
       (SELECT COUNT(*) FROM faqs) AS faqs,
       (SELECT COUNT(*) FROM permissions) AS permissions`
  );

  console.log('\n  Seeded content');
  console.log('  ──────────────');
  console.log(`  Divisions:      ${summary[0].divisions}`);
  console.log(`  Services:       ${summary[0].services}`);
  console.log(`  Packages:       ${summary[0].packages}`);
  console.log(`  Equipment:      ${summary[0].equipment}`);
  console.log(`  Print products: ${summary[0].print_products}`);
  console.log(`  FAQs:           ${summary[0].faqs}`);
  console.log(`  Permissions:    ${summary[0].permissions}`);

  await db.end();

  console.log('\n  Setup complete.');
  console.log('  Start the platform with:  npm run dev\n');
}

main().catch((err) => {
  console.error('\n  Setup failed:', err.message);
  process.exit(1);
});
