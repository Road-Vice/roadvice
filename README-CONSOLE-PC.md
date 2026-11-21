# ROAD VICE — Guide PC, Play Store et consoles

ROAD VICE est déjà un jeu complet jouable maintenant. Ce guide explique comment
le sortir sur **PC**, sur **Play Store (Android)**, et le chemin pour les
**consoles** (PlayStation / Xbox / Switch).

---

## 🍎 Jouer sur iPhone / iPad (3 solutions)

### Solution 1 — La plus simple : jouer dans Safari (sans rien payer)
1. Sur ton **ordinateur** (Mac ou PC), lance `jouer-sur-iphone.sh`.
2. Une adresse s'affiche (genre `http://192.168.1.42:8000`).
3. Sur ton **iPhone**, sur le **même Wi-Fi**, ouvre Safari et tape cette adresse.
4. Pour le plein écran : bouton **Partager** → *Sur l'écran d'accueil* →
   une icône "Road Vice" apparaît sur ton iPhone comme une vraie app 🎮

### Solution 2 — Vraie app iPhone (nécessite un Mac)
Tout est prêt : `make-ios.sh` fabrique le projet iOS.
1. Sur un **Mac** (obligatoire : Apple impose Xcode) avec Node.js installé :
   ```
   bash make-ios.sh
   ```
2. Ouvre le fichier `ios/App/App.xcworkspace` avec **Xcode**.
3. Branche ton iPhone → bouton Run → le jeu s'installe sur le téléphone.
4. Pour l'App Store : compte **Apple Developer (99 $/an)** → Xcode :
   *Product > Archive > Distribute App*.

### Solution 3 — Jouer partout sans ordinateur : GitHub Pages
Si le dossier du jeu est mis sur un dépôt GitHub, activer *GitHub Pages*
(Paramètres → Pages) donne un lien public : le jeu se lance **directement dans
Safari** depuis n'importe quel iPhone, partout, sans serveur.

## 🔍 Tester tout de suite (sans rien installer)

Le plus simple : ouvrir le dossier du jeu et lancer un petit serveur local,
puis ouvrir `http://127.0.0.1:8000` dans Chrome ou Edge.

- Windows : double-clic sur `serveur-windows.bat` (créé automatiquement, voir plus bas)
  sinon, dans un terminal : `python -m http.server`
- Firefox fonctionne aussi (mais Chrome/Edge gèrent mieux la manette).

⚠️ Le jeu télécharge la 3D (three.js) sur Internet. **Il faut une connexion Internet
la première fois.** Pour une version 100 % hors-ligne, il faudra faire
`npm install` puis télécharger three.js en local (voir section "Hors-ligne").

---

## 🎮 Jouer à la manette (PC)

Brancher la manette (Xbox, PlayStation avec câble/Bluetooth) puis appuyer sur
n'importe quel bouton : le jeu la détecte automatiquement.

| Bouton | À pied | En voiture | Téléphone / menus |
|---|---|---|---|
| **Stick gauche** | marcher | tourner le volant | — |
| **Stick droit** | tourner la caméra | tourner la caméra | — |
| **LT** | courir | frein | obligé d'appuyer pour courir |
| **RT** | tirer | accélérer | tirer |
| **A** | entrer / parler / acheter | frein à main | — |
| **X** | monter dans un véhicule / ouvrir une porte | sortir du véhicule | — |
| **B** | se rendre (arrêt volontaire) | — | — |
| **Y** | téléphone (ouvrir / fermer) | téléphone | — |
| **RB** | arme suivante | turbo | — |
| **LB** | arme précédente | — | — |

---

## 💻 Sortir sur PC (Windows / Mac / Linux)

C'est le fichier `electron-main.cjs` qui s'en occupe : il transforme le jeu en
vraie application Windows avec fenêtre et icône.

1. Installer [Node.js](https://nodejs.org) (version LTS).
2. Dans le dossier du jeu, ouvrir un terminal et taper :
   ```
   npm install
   npm start
   ```
3. Le jeu se lance en fenêtre 1280×720, plein écran possible avec F11.

### Ensuite, pour Steam (optionnel)
1. `npm run build` n'existe pas encore : l'étape officielle est d'utiliser
   **electron-builder** (`npm install electron-builder --save-dev`), puis :
   ```
   npx electron-builder --win    # Windows
   npx electron-builder --linux  # Linux
   npx electron-builder --mac    # Mac
   ```
   → ça crée un instalateur `.exe` / `.AppImage` / `.dmg` prêt à distribuer.
2. Sur Steam : payer **100 $** le compte "Steamworks" (une seule fois, remboursé
   si le jeu dépasse 1 000 $ de ventes), puis uploader le `.exe` avec la
   SteamPipe. C'est la partie "comptabilité" du travail, pas du code.

---

## 📱 Sortir sur Play Store (Android)

Tout est déjà prêt : `capacitor.config.json` + `make-android.sh`.

1. Installer [Node.js](https://nodejs.org) et [Android Studio](https://developer.android.com/studio).
2. Dans le dossier du jeu :
   ```
   bash make-android.sh
   ```
   Le script copie le jeu dans `www/`, crée le projet Android natif et le synchronise.
3. Ouvrir **Android Studio** → *Open* → choisir le dossier `android` créé.
4. Menu **Build** → *Build Bundle(s)/APK(s)* → **Build APK(s)** →
   l'APK testable est dans `android/app/build/outputs/apk/debug/`.
5. Pour le Play Store :
   - Compte Google Play Developer : **25 $** une seule fois.
   - Menu **Build** → *Generate Signed Bundle* → fichier **.aab** signé.
   - Publier le .aab sur la console Play (captures d'écran, description, note d'âge).

Les commandes tactiles du téléphone existent déjà dans le jeu (joystick + boutons),
le jeu est donc jouable sur mobile dès l'installation de l'APK.

---

## 🕹️ Consoles (PlayStation / Xbox / Switch)

À être honnête : un jeu console = un **projet natif** (pas du web), fait avec un
moteur comme Unreal ou Unity, et il faut être développeur agréé :

| Plateforme | Programme | Coût |
|---|---|---|
| Xbox | ID@Xbox | Gratuit |
| PlayStation | PlayStation Partners | ~500 $ |
| Nintendo | Developer Portal | Gratuit |

Il faut aussi un **kit de développement** (envoyé après acceptation) et faire
valider le jeu par certification. ROAD VICE est donc en "preview web" ici ; la
route console serait : porter le code vers un moteur natif, refaire le rendu,
puis passer les certifications. C'est un vrai projet de studio, pas réalisable
directement depuis ce fichier — mais le jeu tel quel est déjà très proche de ce qu'on
attend sur mobile/PC indépendant.

---

## 🔌 Version hors-ligne (sans Internet)

Le jeu appelle three.js par CDN (unpkg). Pour un APK/PC sans Internet :

```bash
npm install
# télécharger three.js en local :
mkdir -p vendor
curl -o vendor/three.module.js https://unpkg.com/three@0.160.0/build/three.module.js
```

puis à modifier dans `index.html` l'entrée `"three"` de la balise
`<script type="importmap">` pour pointer vers `./vendor/three.module.js`.

---

## 📖 Résumé des fichiers ajoutés pour PC / Play Store

| Fichier | À quoi ça sert |
|---|---|
| `package.json` | liste des outils (Electron + Capacitor), lance `npm start` |
| `electron-main.cjs` | fenêtre de l'application PC |
| `capacitor.config.json` | identité Android de l'app (`com.roadvice.game`) |
| `make-android.sh` | prépare le projet Android automatiquement |
| `make-ios.sh` | prépare le projet iOS (iPhone) — nécessite un Mac |
| `jouer-sur-iphone.sh` | lance le jeu sur iPhone via Safari (même Wi-Fi) |
| `README-CONSOLE-PC.md` | ce guide |
