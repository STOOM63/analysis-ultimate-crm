# Validation de référence — Analysis Ultimate 3.1.0 API SENTINEL

Ce document sert de test de non-régression. Il ne contient aucune donnée nominative.

## Sources TGM de référence

- Clients : **1 341** lignes.
- Ventes : **15 446** lignes.
- Catalogue : **1 077** lignes.
- Période de ventes détectée : **01/10/2025 → 26/08/2026**.

## Résultats du socle attendus

- Transactions : **5 668**.
- CA TTC total : **238 971,60 €**.
- Articles distincts rencontrés dans les ventes : **984**.

### Clients ↔ ventes

- Transactions certifiées : **5 454**.
- Transactions probables : **157**.
- Transactions anonymes : **57**.
- Conflits d’identifiants forts : **0**.
- Couverture certifiée : **96,2244 %**.
- Couverture certifiée + probable : **98,9944 %**.

### Ventes ↔ catalogue

- Lignes avec Code article exact : **15 180**.
- Lignes sans référence catalogue actuelle : **266**.
- Couverture catalogue : **98,2779 %**.

## Contrôles version 3

Les fichiers JavaScript de la version 3 passent tous le contrôle syntaxique Node (`node --check`). Le script de contexte public passe la compilation Python.

Le moteur Geo Intelligence est testé avec des scénarios synthétiques contrôlés, notamment :

- reconnaissance locale d’une adresse clermontoise « rue Jules Verne » comme micro-zone Brézet / Est commercial ;
- rattachement de Lempdes au groupe Est et au secteur travaux Nord & Est ;
- rattachement de Chamalières à Ouest ;
- rattachement de Cournon-d’Auvergne à Sud ;
- détection d’un décrochage simulé concentré sur Brézet ;
- montée automatique de l’Impact Score lorsque le CA et les visites de la zone décrochent plus fortement que les zones témoins ;
- génération automatique des actions Autopilot : sauvetage clients, plan stock, radar géographique, prévision 7 jours, revisites attendues et contrôle qualité.

## Règles qui doivent rester vraies

1. Une identité client contradictoire bloque le croisement.
2. Une transaction identique répétée dans deux fichiers Ventes est comptée une seule fois.
3. Deux transactions portant la même clé mais ayant un contenu différent créent un conflit bloquant.
4. Une référence absente du catalogue n’est jamais affectée automatiquement à un rayon supposé.
5. Les rapprochements « nom uniquement » restent marqués **probables**, jamais certifiés.
6. Une micro-zone géographique non démontrable n’est jamais inventée.
7. La corrélation travaux / baisse commerciale est présentée comme signal contextuel, jamais comme causalité certaine.
8. Les ventes anonymes restent incluses dans les indicateurs globaux.
9. Une dernière journée probablement incomplète est exclue des diagnostics comparatifs qui pourraient créer une fausse baisse.
10. Les actions externes (contact client, commande fournisseur) ne sont jamais exécutées sans système externe autorisé ; Autopilot exécute les calculs et prépare les listes automatiquement.


## Validation API Sentinel

- compilation Python du connecteur et du validateur ;
- tests unitaires de résolution dynamique des datasets ;
- tests de scoring du catalogue ;
- tests de normalisation stationnement ;
- tests de déduplication API/pages ;
- validation JSON transactionnelle ;
- JavaScript vérifié syntaxiquement ;
- le payload embarqué démarre en mode `seeded` jusqu’au premier Run workflow ;
- l’état réel `API CONNECTÉE` ne doit être affiché qu’après une synchronisation GitHub Actions réussie.
