#!/bin/bash
sudo systemctl stop fotostube.service
cd /opt/fotostube
sudo -u fotostube git pull
sudo -u fotostube npm install
sudo -u fotostube npm run db:push
sudo systemctl start fotostube.service
