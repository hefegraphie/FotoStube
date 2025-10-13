# FotoStube Entwicklungs-Setup

Mit diesem Skript richtet ihr die Entwicklungsumgebung von FotoStube auf einem Linux-System ein.

## Installation & Start
```
apt update

apt install curl

curl -fsSL https://github.com/hefegraphie/FotoStube/raw/main/rundev.sh -o rundev.sh &&
chmod +x rundev.sh &&
sudo ./rundev.sh
```

Das Skript klont das FotoStube-Repo, installiert notwendige Pakete inklusive PostgreSQL, richtet die Datenbank ein, installiert Node.js Abhängigkeiten und fragt interaktiv nach Zugangsdaten.

Nach dem erfolgreichen Setup befindet man sich im `FotoStube`-Verzeichnis und kann die Anwendung im Entwicklungsmodus mit folgendem Befehl starten:
```
npm run dev
```
## Hinweise

- Das Skript muss mit `sudo` ausgeführt werden.
- Während des Setups werden Eingaben für PostgreSQL Benutzername, Passwort sowie ein Testnutzer abgefragt.
- Das Skript pausiert nach jedem einzelnen Schritt zur Überprüfung, mit Enter bestätigen um fortzufahren.

---

So ist der schnelle Entwicklungsstart für FotoStube gewährleistet.

# FotoStube Produktiv-Setup
## Installation & Start
```
apt update

apt install curl

curl -fsSL https://github.com/hefegraphie/FotoStube/raw/main/prodinstall.sh -o prodinstall.sh &&
chmod +x prodinstall.sh &&
sudo ./prodinstall.sh
```
# FotoStube Update
## Update & Start
```
apt update

apt install curl

curl -fsSL https://github.com/hefegraphie/FotoStube/raw/main/update.sh -o update.sh &&
chmod +x update.sh &&
sudo ./update.sh
```
