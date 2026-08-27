# Analysis Ultimate — Basalte-Web

Application web statique d'analyse commerciale avancée pour les extractions TGM. Elle est conçue pour être publiée sur **GitHub Pages** et pour traiter les données **localement dans le navigateur**.

## Ce que fait la version 1.0

- Import guidé et validation stricte de `Clients.xlsx`, `Ventes.csv` et `Catalogue.xlsx` (suffixes numériques acceptés : `Clients(3).xlsx`, `Ventes(1).csv`, etc.).
- Plusieurs fichiers Ventes peuvent être chargés en une fois ; les transactions strictement identiques présentes dans plusieurs extractions sont ignorées une seule fois et les conflits contradictoires bloquent l'analyse.
- Contrôle du schéma, unicité des codes client/article, validité des dates et cohérence `Vente HT - Achat HT = Marge`.
- Croisement clients ↔ ventes par identifiants exacts, avec distinction **certifié / probable / anonyme / conflit**.
- Croisement ventes ↔ catalogue par Code article exact, puis normalisation contrôlée des zéros initiaux si la correspondance reste unique.
- Tableau de bord 30/90 jours, CA, marge, panier, clients à risque, stock sous tension et signaux automatiques.
- Fiches clients 360° : revisite, intervalle médian, risque de perte, valeur historique, changements récents, produits/rayons favoris, matériel acheté, chronologie et signaux explicatifs.
- Produits : CA, marge, clients, taux de réachat, tendance 30 jours, stock, vitesse et couverture.
- Rayons / familles : CA, marge, clients, tickets, produits et tendance.
- Stock : rupture, stock négatif, couverture <7 jours / <21 jours, stock dormant 90 jours.
- Vacances scolaires **Zone A / Clermont-Ferrand** et jours fériés : comparaison normalisée par jours actifs.
- Associations de panier : support, confiance et lift.
- Comparateur libre de deux périodes.
- Audit qualité et traçabilité des limites de chaque analyse.
- Sauvegarde de la dernière session et snapshots de catalogue dans IndexedDB du navigateur.
- Exports CSV de synthèses (jamais automatiques).

## Confidentialité

Les fichiers sélectionnés avec le bouton d'import sont lus par JavaScript dans le navigateur. Analysis Ultimate ne contient aucun appel d'upload des lignes client vers un serveur. La dernière session peut être persistée dans **IndexedDB**, donc sur le poste/navigateur utilisé.

**Important :** ne placez jamais les extractions TGM dans le dépôt GitHub. Le `.gitignore` fourni bloque les extensions courantes de données (`.csv`, `.xlsx`, `.xls`). Un dépôt GitHub Pages public rendrait tout fichier versionné publiquement accessible.

## Mise en ligne sur GitHub Pages

1. Créer un nouveau dépôt GitHub, par exemple `analysis-ultimate`.
2. Décompresser le ZIP et envoyer **le contenu du dossier** à la racine du dépôt (`index.html`, `css/`, `js/`, etc.).
3. Dans GitHub : **Settings → Pages**.
4. Source : **Deploy from a branch**.
5. Branch : `main`, dossier `/ (root)`.
6. Enregistrer. GitHub fournit ensuite l'URL du site.

Aucune étape de compilation n'est nécessaire.

## Bibliothèques d'import

La page charge des versions épinglées :

- SheetJS Community Edition `0.20.3` pour XLS/XLSX.
- Papa Parse `5.6.0` pour les CSV lourds, avec Web Worker.

Elles servent uniquement à lire les fichiers sélectionnés. Le reste du moteur analytique est inclus dans le dépôt. Le Service Worker met en cache les ressources après un premier chargement réussi.

## Règle de fiabilité

Analysis Ultimate ne doit jamais transformer une ambiguïté en certitude :

- **Certifié** : donnée source ou calcul déterministe contrôlé.
- **Partiel** : calcul exact sur la couverture disponible, avec limite explicitée.
- **Estimation / signal** : inférence statistique clairement étiquetée.
- **Bloqué** : incohérence structurelle ou identifiants contradictoires.

Une donnée TGM fausse à la source ne peut pas être rendue vraie par un logiciel. L'objectif est donc de détecter les incohérences mesurables, d'empêcher les rapprochements ambigus et de garder la traçabilité des calculs.

## Calendrier scolaire

Le calendrier Zone A intégré couvre actuellement les périodes scolaires pertinentes de 2024-2025 à 2026-2027. Une date hors calendrier intégré n'est pas classée arbitrairement comme période scolaire.

## Structure

```text
analysis-ultimate/
├── index.html
├── sw.js
├── README.md
├── LICENSE.txt
├── .gitignore
├── css/
│   └── styles.css
└── js/
    ├── constants.js
    ├── utils.js
    ├── importer.js
    ├── storage.js
    ├── analytics.js
    ├── ui.js
    └── app.js
```

## Données attendues

### Clients
Colonnes obligatoires : `Code client`, `Nom prenom`.

### Ventes
Colonnes obligatoires : `Date`, `Num. vente`, `Code article`, `Designation`, `Quantite`, `Vente TTC`.

### Catalogue
Colonnes obligatoires : `Code article`, `Designation`, `Stock`.

Les colonnes complémentaires TGM sont utilisées lorsqu'elles existent pour enrichir les analyses.

## Documentation interne

- `docs/VALIDATION.md` : valeurs de référence obtenues sur les fichiers de conception, sans donnée nominative.
- `docs/DATA_DICTIONARY.md` : règles de normalisation, de croisement et formules principales.
