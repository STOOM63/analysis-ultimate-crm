# Sécurité et confidentialité

Analysis Ultimate est une application statique destinée à fonctionner sur GitHub Pages.

- Les fichiers TGM sont lus localement par le navigateur.
- Les parseurs CSV et XLSX sont inclus dans le projet : aucun CDN n’est nécessaire pour l’import courant.
- Aucune ligne client n’est envoyée à Basalte-Web, GitHub ou à un service d’IA.
- Le moteur de questions métier est local et déterministe.
- La persistance utilise IndexedDB du navigateur.
- Le Content Security Policy limite les scripts et connexions à l’origine du site.
- `.gitignore` empêche l’ajout accidentel des extensions de données courantes.

## Limite importante

Un dépôt GitHub public expose tout fichier réellement versionné. Ne jamais committer une extraction TGM contenant des données personnelles, même temporairement.

## Effacement

Le bouton « Effacer les données locales » supprime la session et les snapshots enregistrés dans le navigateur. Il ne supprime évidemment pas les fichiers sources présents sur l’ordinateur.
