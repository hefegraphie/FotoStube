# FotoStube Produktiv-Setup
## Installation & Start
```
apt update

apt install curl

curl -fsSL https://github.com/hefegraphie/FotoStube/raw/main/prodinstall.sh -o prodinstall.sh &&
chmod +x prodinstall.sh &&
sudo ./prodinstall.sh
```
Das Skript klont das FotoStube-Repo, installiert notwendige Pakete inklusive PostgreSQL, richtet die Datenbank ein, installiert Node.js Abhängigkeiten und fragt interaktiv nach Zugangsdaten.

## Hinweise

- Das Skript muss mit `sudo` ausgeführt werden.
- Während des Setups werden Eingaben für PostgreSQL Benutzername, Passwort sowie ein Testnutzer abgefragt.
- Das Skript pausiert nach jedem einzelnen Schritt zur Überprüfung, mit Enter bestätigen um fortzufahren.

---

So ist der schnelle Entwicklungsstart für FotoStube gewährleistet.

