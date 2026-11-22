#!/usr/bin/env bash
# ROAD VICE - preparation du projet iOS (iPhone / App Store)
# IMPORTANT : iOS se fabrique UNIQUEMENT depuis un Mac avec Xcode installe.
# A lancer sur TON Mac (pas ici) : il faut Node.js + npm + Xcode.
set -e
cd "$(dirname "$0")"

mkdir -p www
cp index.html style.css *.js www/
cp -R vendor www/

echo "==> Installation des outils Capacitor..."
npm install

echo "==> Creation du projet iOS (la 1ere fois seulement)..."
if [ ! -d ios ]; then
  npx cap add ios
fi

echo "==> Synchronisation des fichiers du jeu..."
npx cap sync ios

cat << 'FIN'

|--------------------------------------------------------------------------
| Projet iOS pret !  Dernieres etapes (sur Mac) :
|
| 1. Ouvre le fichier ios/App/App.xcworkspace dans Xcode
| 2. Branche ton iPhone, choisis-le en haut de Xcode, appuie sur Run
|    -> le jeu s'installe sur ton iPhone
| 3. Pour l'App Store :
|    - Compte Apple Developer : 99 $ par an
|    - Dans Xcode : Product > Archive > Distribute App
|
| IMPORTANT : relance ce script a chaque modification du jeu
| (puis refaire "npx cap sync ios").
|--------------------------------------------------------------------------
FIN
