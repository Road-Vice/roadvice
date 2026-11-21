#!/usr/bin/env bash
# ROAD VICE - jouer sur iPhone depuis Safari (le plus simple)
# Lance ce script sur ton ordinateur (Mac/PC), puis sur ton iPhone :
# ouvre Safari -> http://ADRESSE-AFFICHEE:8000 (les deux appareils
# doivent être sur le MEME Wi-Fi).
cd "$(dirname "$0")"
IP=$(python3 -c "import socket;s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);s.connect(('8.8.8.8',80));print(s.getsockname()[0])")
echo ""
echo "==============================================="
echo "  SUR TON IPHONE (meme Wi-Fi), ouvre Safari :"
echo "  http://$IP:8000"
echo "==============================================="
echo ""
echo "(Pour le plein ecran : bouton Partager > Sur l'ecran d'accueil)"
python3 -m http.server 8000 --bind 0.0.0.0
