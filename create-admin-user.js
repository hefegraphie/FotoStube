
import bcrypt from 'bcrypt';
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createAdminUser() {
  try {
    const name = 'admin';
    const email = 'admin@example.com';
    const password = 'demo';
    const role = 'Admin';

    // Hash das Passwort
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Prüfe zuerst, ob der User bereits existiert
    const checkResult = await pool.query(
      'SELECT id, name, email FROM users WHERE name = $1',
      [name]
    );

    if (checkResult.rows.length > 0) {
      console.log('❌ User "admin" existiert bereits:', checkResult.rows[0]);
      // Update email if missing
      if (!checkResult.rows[0].email) {
        await pool.query(
          'UPDATE users SET email = $1 WHERE name = $2',
          [email, name]
        );
        console.log('✅ E-Mail-Adresse wurde hinzugefügt');
      }
      return;
    }

    // Füge den User in die Datenbank ein
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, role]
    );

    console.log('✅ Admin-User erfolgreich erstellt:');
    console.log(result.rows[0]);
    console.log(`\n👤 Name: ${name}`);
    console.log(`📧 E-Mail: ${email}`);
    console.log(`🔑 Passwort: ${password}`);
    
  } catch (error) {
    console.error('❌ Fehler beim Erstellen des Users:');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    console.error('Detail:', error.detail);
  } finally {
    await pool.end();
  }
}

createAdminUser();
