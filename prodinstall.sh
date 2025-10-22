#!/bin/bash

set -e  # Stoppt bei Fehlern

function wait_for_continue() {
  read -p "Weiter mit dem nächsten Schritt? (Enter drücken)"
}

echo "==> System aktualisieren..."
sudo apt update
wait_for_continue

echo "==> Git, curl und PostgreSQL installieren..."
sudo apt install -y git curl postgresql postgresql-contrib
wait_for_continue

git_url="https://github.com/hefegraphie/FotoStube"
install_dir="/opt/fotostube"

if ! id -u fotostube >/dev/null 2>&1; then
  echo "==> Systemuser 'fotostube' anlegen..."
  sudo useradd -r -m -d "$install_dir" -s /usr/sbin/nologin fotostube
fi

sudo apt remove -y nodejs npm || true
sudo apt autoremove -y

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
wait_for_continue

if [ -d "$install_dir" ]; then
    if [ -d "$install_dir/.git" ]; then
        echo "==> Repository existiert, pull..."
        sudo git -C "$install_dir" pull
    else
        echo "==> Existierendes Verzeichnis, aber kein Git-Repo. Backup & neu klonen..."
        sudo mv "$install_dir" "${install_dir}_backup_$(date +%s)"
        sudo git clone "$git_url" "$install_dir"
    fi
else
    echo "==> Repository noch nicht geklont, klone neu..."
    sudo git clone "$git_url" "$install_dir"
fi

sudo chown -R fotostube:fotostube "$install_dir"
wait_for_continue

echo "==> PostgreSQL starten und aktivieren..."
sudo systemctl enable postgresql
sudo systemctl start postgresql
wait_for_continue

sudo -u fotostube bash -c "cd $install_dir && npm install archiver date-fns sharp jsonwebtoken cookie-parser bcrypt"
wait_for_continue

export PORT=5000

read -p "Geben Sie den PostgreSQL Benutzername ein (z.B. hefe): " pg_user
read -sp "Geben Sie das Passwort für PostgreSQL Benutzer $pg_user ein: " pg_pass
echo

sudo -u postgres psql <<EOF
CREATE DATABASE fotostube;
CREATE USER $pg_user WITH PASSWORD '$pg_pass';
GRANT ALL PRIVILEGES ON DATABASE fotostube TO $pg_user;
EOF
wait_for_continue

cat <<EOF | sudo tee "$install_dir/.env" >/dev/null
DATABASE_URL=postgresql://$pg_user:$pg_pass@localhost:5432/fotostube
PORT=5000
EOF
sudo chown fotostube:fotostube "$install_dir/.env"
wait_for_continue

sudo -u fotostube bash -c "cd $install_dir && npm run db:push"
wait_for_continue

# Beispiel-Adminanlage (nur Name + Passwort, Rolle Admin)
read -p "Geben Sie den Namen für den Admin ein: " admin_name
read -sp "Geben Sie das Passwort für den Admin ein: " admin_pass
echo

psql postgresql://$pg_user:$pg_pass@localhost:5432/fotostube <<EOF
INSERT INTO users (name, password, role) VALUES ('$admin_name', '$admin_pass', 'Admin');
EOF
wait_for_continue

echo "==> Systemdienst für Fotostube einrichten..."
sudo bash -c "cat <<EOF > /etc/systemd/system/fotostube.service
[Unit]
Description=Fotostube
After=network.target

[Service]
Type=simple
User=fotostube
WorkingDirectory=$install_dir
ExecStart=$(which npm) run dev
Restart=always
Environment=NODE_ENV=development

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable fotostube.service
sudo systemctl start fotostube.service

echo "✅ Setup abgeschlossen!"
echo "Fotostube läuft jetzt als Systemdienst und startet automatisch beim Systemstart."
echo "Logs ansehen: sudo journalctl -u fotostube.service -f"
