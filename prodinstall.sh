#!/bin/bash

set -e  # Stoppt bei Fehlern

# ==============================================================================
# 1. ROOT-RECHTE & SUDO-HANDLING
# ==============================================================================
if [ "$(id -u)" -eq 0 ]; then
  SUDO="" # Wir sind root, kein sudo nötig
elif command -v sudo >/dev/null 2>&1; then
  SUDO="sudo" # Wir sind normaler User, aber sudo ist da
else
  echo "Fehler: Dieses Skript benötigt Root-Rechte."
  echo "Bitte führen Sie das Skript als 'root' aus oder installieren Sie 'sudo'."
  exit 1
fi

# Hilfsfunktion, um Befehle als ein anderer User (z.B. postgres oder fotostube) auszuführen
run_as() {
  local target_user="$1"
  shift
  local cmd="$*"
  
  # Wir wechseln subshell-basiert nach /tmp, um "Permission denied"-Warnungen 
  # zu vermeiden, falls das Skript aus z. B. /root aufgerufen wird.
  (
    cd /tmp >/dev/null 2>&1
    if command -v sudo >/dev/null 2>&1; then
      sudo -u "$target_user" bash -c "$cmd"
    else
      # Fallback, wenn wir root sind, aber kein sudo haben
      su -s /bin/bash "$target_user" -c "$cmd"
    fi
  )
}

# ==============================================================================
# 2. PAKETMANAGER & DISTRIBUTIONS-ERKENNUNG
# ==============================================================================
if command -v apt-get >/dev/null 2>&1; then
  OS_FAMILY="debian"
  PKG_UPDATE="$SUDO apt-get update"
  PKG_INSTALL="$SUDO apt-get install -y"
  PKG_REMOVE="$SUDO apt-get remove -y"
  PG_PACKAGES="postgresql postgresql-contrib"
  NODE_URL="https://deb.nodesource.com/setup_20.x"
elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
  OS_FAMILY="rhel"
  PKG_MGR=$(command -v dnf >/dev/null 2>&1 && echo "dnf" || echo "yum")
  PKG_UPDATE="$SUDO $PKG_MGR check-update || true"
  PKG_INSTALL="$SUDO $PKG_MGR install -y"
  PKG_REMOVE="$SUDO $PKG_MGR remove -y"
  PG_PACKAGES="postgresql postgresql-server"
  NODE_URL="https://rpm.nodesource.com/setup_20.x"
elif command -v pacman >/dev/null 2>&1; then
  OS_FAMILY="arch"
  PKG_UPDATE="$SUDO pacman -Sy"
  PKG_INSTALL="$SUDO pacman -S --noconfirm"
  PKG_REMOVE="$SUDO pacman -Rns --noconfirm"
  PG_PACKAGES="postgresql"
  NODE_URL="" # Arch bringt aktuelles Node.js direkt mit
else
  echo "Fehler: Nicht unterstützter Paketmanager. Bitte manuell installieren."
  exit 1
fi

function wait_for_continue() {
  read -p "Weiter mit dem nächsten Schritt? (Enter drücken)"
}

# ==============================================================================
# 3. INSTALLATION
# ==============================================================================
echo "==> System aktualisieren..."
$PKG_UPDATE
wait_for_continue

echo "==> Git, curl und PostgreSQL installieren..."
$PKG_INSTALL git curl $PG_PACKAGES
wait_for_continue

# RHEL/Fedora Besonderheit: Datenbank initialisieren
if [ "$OS_FAMILY" = "rhel" ]; then
  echo "==> PostgreSQL initialisieren (RHEL/Fedora spezifisch)..."
  $SUDO postgresql-setup --initdb || true
fi

git_url="https://github.com/hefegraphie/FotoStube"
install_dir="/opt/fotostube"

if ! id -u fotostube >/dev/null 2>&1; then
  echo "==> Systemuser 'fotostube' anlegen..."
  $SUDO useradd -r -m -d "$install_dir" -s /usr/sbin/nologin fotostube
fi

echo "==> Node.js installieren..."
$PKG_REMOVE nodejs npm || true
if [ -n "$NODE_URL" ]; then
  curl -fsSL "$NODE_URL" | $SUDO bash -
fi
$PKG_INSTALL nodejs
wait_for_continue

if [ -d "$install_dir" ]; then
    if [ -d "$install_dir/.git" ]; then
        echo "==> Repository existiert, pull..."
        run_as fotostube "git -C $install_dir config --global --add safe.directory $install_dir"
        run_as fotostube "git -C $install_dir pull"
    else
        echo "==> Existierendes Verzeichnis, aber kein Git-Repo. Backup & neu klonen..."
        $SUDO mv "$install_dir" "${install_dir}_backup_$(date +%s)"
        $SUDO git clone "$git_url" "$install_dir"
    fi
else
    echo "==> Repository noch nicht geklont, klone neu..."
    $SUDO git clone "$git_url" "$install_dir"
fi

$SUDO chown -R fotostube:fotostube "$install_dir"
wait_for_continue

echo "==> PostgreSQL starten und aktivieren..."
$SUDO systemctl enable postgresql
$SUDO systemctl start postgresql
wait_for_continue

run_as fotostube "cd $install_dir && npm install archiver date-fns sharp jsonwebtoken cookie-parser bcrypt dotenv"
wait_for_continue

export PORT=5000

read -p "Geben Sie den PostgreSQL Benutzername ein (z.B. hefe): " pg_user
read -sp "Geben Sie das Passwort für PostgreSQL Benutzer $pg_user ein: " pg_pass
echo

# Anpassung für PostgreSQL 15+ (Debian 12+ / Ubuntu 24.04+)
# Erst User anlegen, dann DB mit Owner anlegen, dann Schema-Rechte vergeben.
run_as postgres "psql -c \"CREATE USER $pg_user WITH PASSWORD '$pg_pass';\"" || true
run_as postgres "psql -c \"CREATE DATABASE fotostube OWNER $pg_user;\"" || true
run_as postgres "psql -c \"ALTER DATABASE fotostube OWNER TO $pg_user;\"" || true
# Connect direkt in die fotostube DB (-d fotostube) und Schema-Rechte geben
run_as postgres "psql -d fotostube -c \"GRANT ALL ON SCHEMA public TO $pg_user;\"" || true

wait_for_continue

# Starkes JWT Secret generieren
jwt_secret=$(openssl rand -hex 32)

# .env Datei anlegen mit jwt_secret
echo "==> .env anlegen..."
$SUDO bash -c "cat <<EOF > $install_dir/.env
DATABASE_URL=postgresql://$pg_user:$pg_pass@localhost:5432/fotostube
PORT=5000
JWT_SECRET=$jwt_secret
EOF"
$SUDO chown fotostube:fotostube "$install_dir/.env"

# Jetzt klappt der DB-Push, da der User Owner ist und Rechte auf das public-Schema hat
run_as fotostube "cd $install_dir && npm run db:push"
wait_for_continue

$SUDO chown -R fotostube:fotostube "$install_dir"

echo "==> Abhängigkeiten installieren (Production, ohne dev)..."
run_as fotostube "cd $install_dir && npm install"

echo "==> Build-Prozess starten..."
run_as fotostube "cd $install_dir && npm run build"

echo "==> .env mit Production-Umgebung anlegen..."
jwt_secret=$(openssl rand -hex 32)
$SUDO bash -c "cat <<EOF > $install_dir/.env
DATABASE_URL=postgresql://$pg_user:$pg_pass@localhost:5432/fotostube
PORT=5000
JWT_SECRET=$jwt_secret
NODE_ENV=production
EOF"
$SUDO chown fotostube:fotostube "$install_dir/.env"

echo "==> Systemdienst für Production setzen..."
$SUDO bash -c "cat <<EOF > /etc/systemd/system/fotostube.service
[Unit]
Description=Fotostube Production
After=network.target

[Service]
Type=simple
User=fotostube
WorkingDirectory=$install_dir
ExecStart=$(command -v npm) run start
Restart=always
Environment=NODE_ENV=production
Environment=PORT=5000

[Install]
WantedBy=multi-user.target
EOF"

$SUDO systemctl daemon-reload
$SUDO systemctl enable fotostube.service
$SUDO systemctl restart fotostube.service

echo "✅ Production Setup abgeschlossen!"
echo "Fotostube läuft als Systemdienst im Production-Modus."
echo "Logs ansehen:         $SUDO journalctl -u fotostube.service -f"
echo "Service-Status:       $SUDO systemctl status fotostube.service"
