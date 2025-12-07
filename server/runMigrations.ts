
import dotenv from "dotenv";
dotenv.config();
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  console.log("Running migrations...");
  
  try {
    // Erstelle nur die neuen Tabellen direkt
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "token" text NOT NULL,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "smtp_host" text,
        "smtp_port" integer,
        "smtp_user" text,
        "smtp_password" text,
        "smtp_from" text,
        "app_url" text,
        "updated_at" timestamp DEFAULT now()
      );
    `);
    
    // Füge Foreign Key nur hinzu, falls er noch nicht existiert
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'password_reset_tokens_user_id_users_id_fk'
        ) THEN
          ALTER TABLE "password_reset_tokens" 
          ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" 
          FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") 
          ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;
    `);
    
    console.log("✅ Migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }

  await pool.end();
}

runMigrations();
