# Validation de non-régression — Analysis Ultimate 2.0.0 ULTIMATE

Les fichiers de conception TGM ont été utilisés uniquement pour contrôler le moteur. Ils ne sont pas inclus dans le projet livré.

## Import local

Tests réalisés avec les parseurs intégrés `csv.js` et `xlsx-lite.js`, sans SheetJS ni Papa Parse externes.

### Clients

- 1 341 lignes validées.
- 1 341 Codes client non vides.
- 1 341 Codes client uniques.
- Couverture téléphone : ~88,1 %.
- Couverture e-mail : ~70,4 %.

### Ventes

- 15 446 lignes validées.
- 5 668 transactions reconstruites.
- Période détectée : 01/10/2025 09:39:51 → 26/08/2026 18:01:01.
- CA TTC : 238 971,60 € (écart machine uniquement lié aux flottants binaires avant formatage).
- 15 446 / 15 446 lignes contrôlées pour `Vente HT - Achat HT = Marge`.
- 0 incohérence au seuil de 0,03 €.
- 213 lignes de retour.

### Catalogue

- 1 077 références validées.
- 1 077 Codes article uniques.
- 213 références à stock 0.
- 6 références à stock négatif signalées comme anomalie.

## Croisements

### Clients ↔ ventes

Sur 5 668 transactions :

- 5 454 correspondances certifiées ;
- 157 correspondances probables (nom exact unique seulement) ;
- 57 transactions anonymes ;
- 0 transaction non appariée non anonyme ;
- 0 conflit d’identité.

Couverture certifiée : **96,22 %**.
Couverture certifiée + probable : **98,99 %**.

### Ventes ↔ catalogue

Sur 15 446 lignes :

- 15 180 correspondances exactes ;
- 266 références historiques absentes du catalogue courant.

Couverture : **98,28 %**.
Les 266 lignes historiques non classifiables ne reçoivent aucune catégorie inventée.

## Diagnostic autonome

Sur les mêmes données, le moteur 2.0 produit automatiquement :

- 33 diagnostics incluant l’avertissement qualité ;
- une fenêtre comparative de 30 jours vs 30 jours ;
- détection correcte de la dernière journée comme **non partielle** (dernière transaction 18:01, médiane récente de fin d’activité ~18:47) ;
- CA récent : 19 370,27 € contre 20 746,84 €, soit environ -6,6 % ;
- effet fréquentation : environ -1 622,18 € ;
- effet panier : environ +245,61 € ;
- 121 clients classés en risque élevé selon leur rythme individuel de revisite ;
- 59 références actives avec couverture de stock sensible selon la vitesse récente.

Le rendu de la page **Diagnostic autonome** et le moteur de questions locales ont également été exécutés dans un navigateur Chromium sans erreur JavaScript.

## Tests techniques

- Tous les fichiers JavaScript passent `node --check`.
- Les trois fichiers réels sont lus par les parseurs locaux dans un navigateur headless sans erreur.
- Le modèle complet restitue 1 341 clients, 5 668 transactions et 984 produits vendus distincts.
- La question « Pourquoi mon CA baisse ? » renvoie 8 éléments hiérarchisés, avec causes arithmétiques avant hypothèses.

## Principe

Ces contrôles prouvent la conformité du logiciel avec les fichiers de conception observés. Ils ne peuvent pas garantir la vérité d’une donnée TGM incorrecte à la source ; dans ce cas, Analysis Ultimate cherche à détecter les incohérences mesurables et évite les rapprochements ambigus.
