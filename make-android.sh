#!/usr/bin/env bash
# ROAD VICE - preparation du projet Android (APK / Play Store)
# A lancer sur TON ordinateur (pas ici) : il faut Node.js + npm + Android Studio.
set -e
cd "$(dirname "$0")"

mkdir -p www
cp index.html style.css *.js www/
cp -R vendor www/

echo "==> Installation des outils Capacitor..."
npm install

echo "==> Creation du projet Android (la 1ere fois seulement)..."
if [ ! -d android ]; then
  npx cap add android
fi

echo "==> Synchronisation des fichiers du jeu..."
npx cap sync android

cat << 'FIN'

|--------------------------------------------------------------------------
| Projet Android pret !  Derniere etape pour obtenir l'APK :
|
| 1. Installe Android Studio : https://developer.android.com/studio
| 2. Ouvre le dossier "android" qui vient d'etre cree dans ROAD VICE
| 3. Menu Build > Build Bundle(s)/APK(s) > Build APK(s)
| 4. L'APK est dans android/app/build/outputs/apk/debug/app-debug.apk
|
| Pour le Play Store :
| - Compte developpeur Google Play (25$ une seule fois)
| - Menu Build > Generate Signed Bundle > .aab (signe avec ta cle)
| - Envoie le .aab sur la console Play avec des captures d'ecran
|
| IMPORTANT : ce script doit être relance a chaque modification du jeu
| (puis refaire "npx cap sync android").
|--------------------------------------------------------------------------
FIN
