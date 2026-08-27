# Sécurité et confidentialité

Analysis Ultimate est conçu pour analyser des données clients sensibles dans le navigateur.

- Ne jamais ajouter les exports TGM au dépôt GitHub.
- Préférer un dépôt privé si la configuration GitHub Pages disponible le permet ; sinon, le code peut être public mais **les données ne doivent jamais l'être**.
- Le Content Security Policy de `index.html` limite les connexions réseau applicatives à l'origine du site et autorise uniquement les deux CDN nécessaires aux bibliothèques de parsing épinglées.
- La persistance IndexedDB est locale au navigateur. Sur un poste partagé, utiliser le bouton « Effacer les données locales » après utilisation.
- Les exports CSV générés par le logiciel sont téléchargés sur le poste : ils doivent être protégés comme les données TGM originales.
