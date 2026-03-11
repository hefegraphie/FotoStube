### FotoStube Produktiv-Setup

## Installation & Start

### Variante A: Docker Installation (Empfohlen)
Die Installation über Docker ist der einfachste und sauberste Weg, da keine direkten Systemeingriffe nötig sind. Bilder und Datenbank bleiben bei Updates erhalten.
*(Voraussetzung: Docker und Docker Compose sind auf dem System installiert)*

**1. Verzeichnis anlegen**
Erstelle einen neuen, leeren Ordner für FotoStube und wechsle dorthin:
```bash
mkdir fotostube
cd fotostube
```

**2. Passwörter festlegen (.env)**
Erstelle eine Datei für deine geheimen Passwörter:
```bash
nano .env
```
Füge folgenden Text ein und ersetze die Platzhalter durch eigene, sichere Werte:
```text
DB_PASS=dein_super_sicheres_passwort
JWT_SECRET=ein_sehr_langes_zufaelliges_geheimnis
```
*(Speichern & Schließen in nano: `Strg + O` -> `Enter` -> `Strg + X`)*

**3. Docker Compose Datei anlegen**
Erstelle die Bauanleitung für Docker:
```bash
nano docker-compose.yml
```
Kopiere diesen kompletten Block hinein:
```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: hefe
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: fotostube
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hefe -d fotostube"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    image: ghcr.io/hefegraphie/fotostube:latest
    restart: unless-stopped
    ports:
      - "5000:5000"
    depends_on:
      db:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgresql://hefe:${DB_PASS}@db:5432/fotostube
      - PORT=5000
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads

volumes:
  pgdata:
```
*(Speichern & Schließen in nano: `Strg + O` -> `Enter` -> `Strg + X`)*

**4. FotoStube starten**
Lade das System herunter und starte es im Hintergrund:
```bash
docker-compose up -d
```

**Fertig!** FotoStube ist jetzt unter `http://<deine-server-ip>:5000` erreichbar. Deine Bilder werden automatisch in dem neuen Ordner `./uploads` gespeichert. Updates installierst du künftig einfach mit `docker-compose pull && docker-compose up -d`.

---

### Variante B: Manuelle Installation (Bare-Metal, VPS oder LXC)

#### Ubuntu 22.04
```bash
apt update
```
```bash
apt install curl
```
```bash
curl -fsSL https://github.com/hefegraphie/FotoStube/raw/main/prodinstall.sh -o prodinstall.sh
chmod +x prodinstall.sh
sudo ./prodinstall.sh
```

#### Debian 13
```bash
apt update
```
```bash
apt install curl
```
```bash
curl -fsSL https://github.com/hefegraphie/FotoStube/raw/main/prodinstall.sh -o prodinstall.sh
chmod +x prodinstall.sh
./prodinstall.sh
```

Das Skript klont das FotoStube-Repo, installiert notwendige Pakete inklusive PostgreSQL, richtet die Datenbank ein, installiert Node.js Abhängigkeiten und fragt interaktiv nach Zugangsdaten.

#### Hinweise zur manuellen Installation
- Das Skript muss mit `sudo` bzw. als `root` ausgeführt werden.
- Während des Setups werden Eingaben für PostgreSQL Benutzername und Passwort abgefragt.
- Das Skript pausiert nach jedem einzelnen Schritt zur Überprüfung, mit `Enter` bestätigen um fortzufahren.

---
So ist der schnelle Start für FotoStube auf jedem System gewährleistet.
```
