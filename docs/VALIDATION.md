# Validation de référence — Analysis Ultimate 1.0.0

Ce document sert de test de non-régression avec les trois extractions TGM fournies lors de la conception. Il ne contient aucune donnée nominative.

## Sources testées

- Clients : 1 341 lignes.
- Ventes : 15 446 lignes.
- Catalogue : 1 077 lignes.
- Période de ventes détectée : 01/10/2025 → 26/08/2026.

## Résultats attendus du moteur

- Transactions : **5 668**.
- CA TTC total : **238 971,60 €** (écarts flottants d'affichage tolérés à la précision machine ; affichage final arrondi à 2 décimales).
- Articles distincts rencontrés dans les ventes : **984**.
- Rayons rencontrés : **12** en incluant « Non classé ».

### Clients ↔ ventes

- Transactions certifiées : **5 454**.
- Transactions probables (nom exact unique seulement) : **157**.
- Transactions anonymes : **57**.
- Transactions non rattachées : **0**.
- Conflits d'identifiants forts : **0**.
- Couverture certifiée : **96,2244 %**.
- Couverture certifiée + probable : **98,9944 %**.

### Ventes ↔ catalogue

- Lignes avec Code article exact : **15 180**.
- Lignes sans référence catalogue actuelle : **266**.
- Couverture catalogue : **98,2779 %**.
- Les 266 lignes historiques non rattachées restent non classées lorsqu'aucun rayon n'est présent dans l'export Ventes.

## Règles qui doivent rester vraies

1. Une identité client contradictoire bloque le croisement.
2. Une transaction identique répétée dans deux fichiers Ventes est comptée une seule fois.
3. Deux transactions portant la même clé mais ayant un contenu différent créent un conflit bloquant.
4. Une référence absente du catalogue n'est jamais affectée automatiquement à un rayon supposé.
5. Les rapprochements « nom uniquement » restent marqués **probables**, jamais certifiés.
6. Les analyses de risque de perte ou de cause possible restent étiquetées comme calculs / estimations / signaux selon leur nature.
7. Le CA global ne dépend pas de la capacité à identifier un client : les ventes anonymes restent incluses dans les indicateurs commerciaux globaux.
