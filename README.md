# Volley Hub — installer sur ton iPhone

Ton app est maintenant une **Progressive Web App (PWA)** : une fois hébergée en ligne, tu l'installes depuis Safari et elle se comporte comme une vraie app (icône sur l'écran d'accueil, plein écran, fonctionne hors ligne).

## Étape 1 — Héberger les fichiers (gratuit, ~5 minutes)

**Option recommandée : GitHub Pages**

1. Va sur [github.com](https://github.com) et crée un compte si tu n'en as pas.
2. Crée un nouveau repository (ex. `volley-hub`), public.
3. Mets-y les 6 fichiers de ce dossier :
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - `icons/icon-192.png`
   - `icons/icon-512.png`
   - `icons/apple-touch-icon.png`
   (Tu peux glisser-déposer les fichiers directement sur la page GitHub via "Add file" → "Upload files". Garde bien le dossier `icons/`.)
4. Dans le repository : **Settings** → **Pages** → sous "Branch", choisis `main` et `/ (root)` → **Save**.
5. GitHub te donne un lien du type `https://tonpseudo.github.io/volley-hub/` (ça prend 1-2 minutes à s'activer).

## Étape 2 — Installer sur ton iPhone

1. Ouvre ce lien dans **Safari** sur ton iPhone (important : ça ne fonctionne pas depuis Chrome sur iOS).
2. Appuie sur le bouton **Partager** (le carré avec la flèche vers le haut).
3. Fais défiler et appuie sur **"Sur l'écran d'accueil"**.
4. Confirme — l'icône Volley Hub apparaît sur ton écran d'accueil.

Une fois installée, l'app s'ouvre en plein écran (sans la barre Safari) et fonctionne même sans connexion.

## Important à savoir

- **Tes données restent sur ton téléphone** : elles sont stockées localement dans Safari/l'app installée. Rien n'est envoyé à un serveur.
- Si tu réinstalles l'app ou changes de téléphone, tes données ne se transfèrent pas automatiquement — il n'y a pas de sauvegarde cloud pour l'instant.
- Si tu modifies le code plus tard (nouveaux exercices, ajustements), il suffit de remplacer les fichiers dans ton repository GitHub — l'app se met à jour automatiquement au prochain lancement.
