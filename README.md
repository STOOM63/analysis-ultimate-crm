# Analysis Ultimate — Basalte-Web

**Version 2.0.0 ULTIMATE** — application web d’intelligence commerciale autonome pour les extractions TGM, conçue pour être publiée sur GitHub Pages et traiter les données localement dans le navigateur.

## Principe

L’utilisateur charge trois sources :

- `Clients.xlsx` — suffixes numériques tolérés (`Clients(3).xlsx`, etc.) ;
- un ou plusieurs `Ventes.csv` ;
- `Catalogue.xlsx`.

Chaque fichier est contrôlé séparément. Lorsque les trois sources sont valides, **le croisement et le diagnostic autonome se lancent automatiquement**. Une ambiguïté bloquante n’est jamais transformée silencieusement en résultat.

## Moteur autonome 2.0

Analysis Ultimate ne se limite plus à afficher des tableaux. Le module `js/intelligence.js` produit automatiquement :

- un **brief de direction** ;
- un **indice de pilotage** et un statut de situation ;
- une décomposition exacte de la variation de CA entre **effet fréquentation** et **effet panier** ;
- les rayons, familles et produits qui contribuent le plus aux hausses et baisses ;
- les mouvements de clientèle entre deux périodes comparables ;
- les clients dont la revisite s’écarte fortement de leur propre rythme historique ;
- les signaux stock, prix, migration produit, remise, retours et calendrier pouvant contribuer à une évolution ;
- les journées statistiquement anormales en les comparant aux mêmes jours de semaine ;
- les associations de panier surreprésentées (support, confiance, lift) ;
- les références à sécuriser en stock et une couverture théorique ;
- les clients qui arrivent dans leur fenêtre habituelle de revisite ;
- une liste d’**actions prioritaires**, reliées aux diagnostics qui les ont produites ;
- un moteur local de questions métier : « Pourquoi mon CA baisse ? », « Quels clients sont à risque ? », « Que dois-je commander ? », etc.

Les explications distinguent toujours : **fait**, **calcul**, **estimation** et **hypothèse**.

## Périodes arbitraires

Le logiciel détecte la période réellement contenue dans les fichiers Ventes. Pour le diagnostic comparatif :

- avec au moins 60 jours d’historique : 30 jours vs 30 jours ;
- avec moins d’historique : la fenêtre est réduite automatiquement afin de conserver deux périodes comparables ;
- si la dernière journée semble avoir été exportée nettement avant l’heure habituelle de fin d’activité, elle est exclue automatiquement du diagnostic comparatif pour éviter une fausse baisse.

## Import 100 % local

La version Ultimate contient ses propres moteurs :

- `js/csv.js` : lecteur CSV local exécuté en Web Worker, compatible champs quotés et gros fichiers ;
- `js/xlsx-lite.js` : lecteur XLSX local adapté aux exports tabulaires TGM.

Aucun CDN n’est nécessaire pour lire les `.csv` et `.xlsx`. Le format historique `.xls` n’est pas accepté par défaut : exporter TGM en `.xlsx`.

## Analyses métier disponibles

- Vue générale et diagnostic autonome.
- Clients 360° : revisite, retard, panier, valeur, matériel, consommables, chronologie et signaux.
- Alertes & opportunités.
- Fidélisation, cohortes et géographie.
- Produits, réachat, tendance, marge et rotation.
- Rayons & familles.
- Stock : négatif, zéro, critique, faible, dormant, couverture.
- Vendeurs & remises avec avertissement explicite lorsque les heures de présence ne sont pas disponibles.
- Vacances scolaires Zone A / Clermont-Ferrand et jours fériés.
- Associations de panier.
- Comparateur libre de périodes.
- Qualité & traçabilité.

## Fiabilité

Analysis Ultimate applique les règles suivantes :

- **Certifié** : donnée source ou calcul déterministe vérifié.
- **Partiel** : calcul exact sur la couverture réellement disponible.
- **Estimation** : résultat statistique ou prévision clairement signalée.
- **Signal / hypothèse** : association plausible, jamais présentée comme causalité certaine.
- **Bloqué** : contradiction structurelle empêchant une analyse sûre.

Le logiciel peut détecter de nombreuses incohérences, mais ne peut pas rendre vraie une donnée TGM erronée à la source.

## Confidentialité

Les extractions sont lues dans le navigateur. Aucune ligne client n’est envoyée à Basalte-Web, GitHub ou un serveur d’analyse. La dernière session et les snapshots catalogue peuvent être conservés dans IndexedDB sur le poste utilisé.

**Ne jamais déposer les extractions TGM dans GitHub.** Le `.gitignore` fourni bloque `.csv`, `.xlsx`, `.xls`, `.ods` et `.zip`.

## Installation GitHub Pages

1. Décompresser `analysis-ultimate-ultimate.zip`.
2. Envoyer **le contenu du dossier** à la racine du dépôt GitHub.
3. GitHub → **Settings → Pages**.
4. Source : **Deploy from a branch**.
5. Branche : `main`, dossier `/ (root)`.
6. Ouvrir la page publiée et vérifier que le pied de page affiche `v2.0.0 ULTIMATE`.

Le Service Worker utilise un cache versionné et une stratégie réseau prioritaire afin que les mises à jour GitHub soient récupérées plus rapidement.

## Structure

```text
analysis-ultimate/
├── index.html
├── manifest.webmanifest
├── sw.js
├── README.md
├── SECURITY.md
├── LICENSE.txt
├── .gitignore
├── .nojekyll
├── css/
│   └── styles.css
├── docs/
│   ├── DATA_DICTIONARY.md
│   ├── INTELLIGENCE_ENGINE.md
│   └── VALIDATION.md
└── js/
    ├── constants.js
    ├── utils.js
    ├── csv.js
    ├── xlsx-lite.js
    ├── importer.js
    ├── storage.js
    ├── analytics.js
    ├── intelligence.js
    ├── ui.js
    └── app.js
```

## Documentation

- `docs/VALIDATION.md` : tests de non-régression sur les fichiers TGM de conception.
- `docs/DATA_DICTIONARY.md` : normalisation, croisements et indicateurs.
- `docs/INTELLIGENCE_ENGINE.md` : fonctionnement et limites du diagnostic autonome.
