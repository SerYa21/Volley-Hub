# Volley Hub V2 — version de test

Une application web installable pour saisir la séance pendant qu'elle se déroule. Le code V1 fourni reste intact.

## Ce qui est prêt

- Musculation : quatre programmes de départ, séance libre, séries validées une par une, valeurs proposées depuis la dernière séance terminée, copie de la première série vers la suivante si elle est encore vide, ajout, remplacement et ordre des exercices sans modifier le programme habituel.
- Bibliothèque de plus de 120 exercices, recherche français/anglais, filtres par matériel, favoris et exercices personnalisés.
- Volley : pratique d'équipe, pratique individuelle, match et tournoi ; exercices effectués, points travaillés, note libre et résultat de match. La rotation de chaussures est modifiable et n'apparaît que dans les séances de volley.
- Agenda : dates prévues distinctes des séances réalisées, ajout ponctuel, import privé d'un relevé Google et connexion Google en lecture seule.
- Import V1 et sauvegarde V2 en JSON, stockage local utilisable hors ligne. Aucun score de fatigue ni tonnage.

## Essayer l'application

Publier **le contenu de ce dossier** sur un hébergement HTTPS, par exemple le GitHub Pages déjà utilisé par la V1. Ouvrir ensuite l'URL sur l'iPhone, puis utiliser « Ajouter à l'écran d'accueil » si souhaité. L'application n'exige pas de compte, de plugin ChatGPT, de serveur ou de dépendance JavaScript à installer pour ces fonctions locales.

Pour une prévisualisation sur ordinateur, depuis ce dossier :

```sh
python3 -m http.server 8123
```

Ouvrir `http://localhost:8123`. Ne pas ouvrir directement `index.html` depuis Fichiers : les modules et le stockage hors ligne demandent un serveur web.

### Importer les données personnelles

1. **Avant de remplacer la V1**, exporter sa sauvegarde JSON depuis la V1 et conserver ce fichier.
2. Dans V2, ouvrir **Réglages → Importer V1, V2 ou dates**, puis choisir la sauvegarde V1. Vérifier l'aperçu et confirmer. Les séries V1 déjà saisies mais non marquées « terminées » restent des propositions à vérifier ; l'import ne les déclare pas réalisées. Réimporter le même fichier n'ajoute pas de doublons.
3. Importer séparément `volley-dates-2026-09-28.json` remis avec cette version. Il contient les 64 dates de volley relevées dans Google Agenda le 28 septembre 2026, jusqu'au 1er mai 2027. Le fichier est **privé** : il ne fait pas partie du dossier à publier. Un événement prévu n'est jamais une séance réalisée.
4. Faire un export V2 dans Réglages et vérifier que le fichier est présent dans Fichiers ou iCloud Drive. Les données restent sur cet appareil ; une suppression de l'application ou du stockage du navigateur peut les effacer.

### Actualiser Google Agenda depuis l'application

Le connecteur Google Agenda de ChatGPT a permis de créer le relevé initial, mais ne transmet pas son autorisation à cette application web. Pour la synchronisation directe :

1. Dans Google Cloud, créer ou choisir un projet, activer **Google Calendar API** et configurer l'écran de consentement OAuth pour son compte.
2. Créer un **ID client OAuth 2.0 de type application Web** et ajouter l'origine HTTPS exacte du site aux **origines JavaScript autorisées**. Pour une URL GitHub Pages `https://nom.github.io/depot/`, l'origine est `https://nom.github.io`.
3. Coller seulement l'**ID client** dans Réglages → Google Agenda, puis toucher **Connecter / actualiser**. Sélectionner les événements proposés dans l'aperçu. Ne jamais mettre un secret client dans ce dossier.

Cette version lit le calendrier principal, en lecture seule, environ un an à l'avance. La connexion et l'actualisation se font à la demande ; l'autorisation doit être renouvelée après expiration. Une synchronisation automatique en arrière-plan demanderait un composant serveur. L'écran de consentement et la connexion sur l'iPhone restent à vérifier avec l'URL HTTPS finale.

Documentation Google : [démarrage JavaScript Calendar](https://developers.google.com/workspace/calendar/api/quickstart/js), [ID client et origines](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid), [modèle de jeton](https://developers.google.com/identity/oauth2/web/guides/use-token-model).

## Vérification technique

`npm test` lance les tests du modèle sans installer de dépendance. Le parcours navigateur a été vérifié à 390 px et 320 px : validation et sauvegarde immédiate, remplacement d'exercice, chaussure, note, résultat de match, import des dates et V1 sans doublon, agenda et rechargement hors ligne. L'autorisation Google réelle et le comportement exact sur l'iPhone de l'utilisateur nécessitent le site HTTPS final.
