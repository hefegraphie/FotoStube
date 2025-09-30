# FotoStube Entwicklungs-Setup

Mit diesem Skript richtet ihr die Entwicklungsumgebung von FotoStube auf einem Linux-System ein.

## Installation & Start

curl -fsSL https://github.com/hefegraphie/FotoStube/raw/main/rundev.sh -o rundev.sh &&

chmod +x rundev.sh &&

sudo ./rundev.sh

Das Skript klont das FotoStube-Repo, installiert notwendige Pakete inklusive PostgreSQL, richtet die Datenbank ein, installiert Node.js Abhängigkeiten und fragt interaktiv nach Zugangsdaten.

Nach dem erfolgreichen Setup befindet man sich im `FotoStube`-Verzeichnis und kann die Anwendung im Entwicklungsmodus mit folgendem Befehl starten:
