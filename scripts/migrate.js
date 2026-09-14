const fs = require("fs");
const path = require("path");

console.log("================================================================");
console.log("   HIVE INSPECT — AUTOMATED DATABASE MIGRATION RUNNER");
console.log("================================================================\n");

// 1. Helper to parse .env.local or .env
function loadEnv() {
  const envPaths = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
  ];

  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf8");
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error("❌ ERROR: Missing DATABASE_URL in .env.local\n");
  console.log("To run migrations automatically via command line, add your Supabase connection string:");
  console.log("1. Open your Supabase project: https://supabase.com/dashboard");
  console.log("2. Navigate to: Project Settings -> Database");
  console.log("3. Scroll to 'Connection string' -> Select 'URI'");
  console.log("4. Copy the connection string and replace [YOUR-PASSWORD] with your actual DB password.");
  console.log("5. Add this line to your .env.local file:\n");
  console.log('   DATABASE_URL="postgresql://postgres.[project-ref]:[your-password]@aws-0-[region].pooler.supabase.com:6543/postgres"\n');
  console.log("Then rerun:");
  console.log("   npm run db:migrate\n");
  process.exit(1);
}

// 2. Check for pg client
let Client;
try {
  Client = require("pg").Client;
} catch {
  console.error("❌ 'pg' (node-postgres) is required to run automated migrations.");
  console.log("Please install it by running:\n");
  console.log("   npm install pg\n");
  process.exit(1);
}

// 3. Locate SQL migration file
const migrationPath = path.resolve(
  __dirname,
  "../supabase/migrations/20260914000000_create_template_importer_schema.sql"
);

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Migration file not found at: ${migrationPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, "utf8");

// 4. Connect and execute
async function runMigration() {
  console.log("Connecting to PostgreSQL database...");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Connected successfully.");

    console.log("Applying migration 20260914000000_create_template_importer_schema.sql...");
    await client.query(sql);

    console.log("\n================================================================");
    console.log("🎉 DATABASE MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("   - Table 'templates' created / verified");
    console.log("   - Table 'sections' created / verified");
    console.log("   - Table 'items' created / verified");
    console.log("   - Table 'comments' created / verified");
    console.log("   - Table 'import_runs' created / verified");
    console.log("   - Table 'import_warnings' created / verified");
    console.log("   - Indexes and cascading delete triggers configured");
    console.log("================================================================\n");
    console.log("Next step: Seed the database with the initial template by running:");
    console.log("   npm run seed\n");
  } catch (err) {
    console.error("\n❌ MIGRATION FAILED:");
    console.error(err.message || err);

    if (err.message && err.message.includes("ENOTFOUND") && err.message.includes("db.")) {
      console.log("\n💡 WHY THIS HAPPENED:");
      console.log("Supabase direct connections ('db.xxxx.supabase.co') use IPv6, which is not supported by all networks/ISPs.");
      console.log("Supabase provides an IPv4 Connection Pooler (Supavisor) specifically for this.\n");
      console.log("👉 HOW TO FIX IN 30 SECONDS:");
      console.log("1. In your Supabase dashboard, go to: Project Settings > Database");
      console.log("2. Under 'Connection string', choose 'Session' (port 5432) or 'Transaction' (port 6543)");
      console.log("3. Copy the pooler URI that looks like:");
      console.log("   postgresql://postgres.wfciqcyguxmaebrytcny:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres");
      console.log("4. Paste that into .env.local as DATABASE_URL and run 'npm run db:setup' again!\n");
    }
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

runMigration();
