#!/bin/bash

function wait_for_continue() {
  read -p "Weiter mit dem nächsten Schritt? (Enter drücken)"
}

sudo apt update
wait_for_continue

sudo apt install -y git
wait_for_continue

# Repository URL fest vorgegeben
git_url="https://github.com/hefegraphie/FotoStube"

if [ -d "FotoStube" ]; then
  echo "FotoStube Verzeichnis existiert, hole neueste Änderungen..."
  cd FotoStube && git pull
else
  git clone "$git_url" FotoStube
  cd FotoStube
fi
wait_for_continue

sudo apt install -y npm curl postgresql postgresql-contrib
wait_for_continue

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
wait_for_continue

sudo apt-get remove -y libnode-dev
wait_for_continue

sudo apt-get install -y nodejs
wait_for_continue

sudo systemctl start postgresql
wait_for_continue

sudo systemctl enable postgresql
wait_for_continue

npm install archiver --save
wait_for_continue

npm install date-fns
wait_for_continue

npm install sharp
wait_for_continue

export PORT=5000
wait_for_continue

# PostgreSQL Setup
read -p "Geben Sie den PostgreSQL Benutzername ein (z.B. hefe): " pg_user
read -sp "Geben Sie das Passwort für PostgreSQL Benutzer $pg_user ein: " pg_pass
echo

sudo -u postgres psql <<EOF
CREATE DATABASE fotostube;
CREATE USER $pg_user WITH PASSWORD '$pg_pass';
GRANT ALL PRIVILEGES ON DATABASE fotostube TO $pg_user;
EOF
wait_for_continue

# .env Datei anlegen
cat <<EOF > .env
DATABASE_URL=postgresql://$pg_user:$pg_pass@localhost:5432/fotostube
EOF
wait_for_continue

npm run db:push
wait_for_continue

# Beispiel-User anlegen
read -p "Geben Sie den Username für Testbenutzer ein (z.B. alex): " test_user
read -p "Geben Sie die Email für Testbenutzer ein (z.B. alex@example.com): " test_email
read -sp "Geben Sie das Passwort für Testbenutzer ein: " test_pass
read -p "Geben Sie den Namen für Testbenutzer ein: " test_name

psql postgresql://$pg_user:$pg_pass@localhost:5432/fotostube <<EOF
INSERT INTO users (username, email, password, name) VALUES ('$test_user', '$test_email', '$test_pass', '$test_name');
EOF
wait_for_continue

echo "Setup abgeschlossen. Starten Sie die Applikation mit 'npm run dev'."

# Ins Verzeichnis wechseln
cd FotoStube
