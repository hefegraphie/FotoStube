#!/bin/bash

# Clone Git repository

echo "Bitte Git-Repository URL eingeben:"
read git_url

if [ -d "FotoStube" ]; then
  echo "FotoStube directory exists, pulling latest changes..."
  cd FotoStube && git pull
else
  git clone "$git_url" FotoStube
  cd FotoStube
fi

sudo apt update
sudo apt install -y npm curl postgresql postgresql-contrib

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get remove -y libnode-dev
sudo apt-get install -y nodejs

sudo systemctl start postgresql
sudo systemctl enable postgresql

npm install archiver --save
npm install date-fns
npm install sharp

export PORT=5000

# PostgreSQL setup

read -p "Geben Sie den PostgreSQL Benutzername ein (z.B. hefe): " pg_user
read -sp "Geben Sie das Passwort für PostgreSQL Benutzer $pg_user ein: " pg_pass
echo

sudo -u postgres psql <<EOF
CREATE DATABASE fotostube;
CREATE USER $pg_user WITH PASSWORD '$pg_pass';
GRANT ALL PRIVILEGES ON DATABASE fotostube TO $pg_user;
EOF

# Create .env file
cat <<EOF > .env
DATABASE_URL=postgresql://$pg_user:$pg_pass@localhost:5432/fotostube
EOF

npm run db:push

# Insert sample user
read -p "Geben Sie den Username für Testbenutzer ein (z.B. alex): " test_user
read -p "Geben Sie die Email für Testbenutzer ein (z.B. alex@example.com): " test_email
read -sp "Geben Sie das Passwort für Testbenutzer ein: " test_pass
read -p "Geben Sie den Namen für Testbenutzer ein: " test_name

psql postgresql://$pg_user:$pg_pass@localhost:5432/fotostube <<EOF
INSERT INTO users (username, email, password, name) VALUES ('$test_user', '$test_email', '$test_pass', '$test_name');
EOF

echo "Setup abgeschlossen. Starten Sie die Applikation mit 'npm run dev'."
