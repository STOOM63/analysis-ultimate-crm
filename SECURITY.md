# Sécurité et confidentialité — Analysis Ultimate 3.1

## Données TGM

Clients, Ventes et Catalogue sont lus localement dans le navigateur. Ils ne sont pas envoyés au dépôt GitHub, à Basalte-Web, à Clermont Auvergne Métropole ni à Open-Meteo.

Le `.gitignore` bloque les formats de données les plus courants : CSV, XLS, XLSX, ODS et ZIP.

## Clermont API Sentinel

Le workflow GitHub Actions ne manipule que des données publiques. Il interroge :

- l’Explore API v2.1 de Clermont Auvergne Métropole ;
- les pages publiques de travaux de la Métropole ;
- Open-Meteo.

Il n’a techniquement aucun accès aux fichiers sélectionnés localement par l’utilisateur sur GitHub Pages.

## Adresses clients

Aucune adresse client n’est envoyée vers la Base Adresse Locale ou un géocodeur. Le connecteur vérifie uniquement des jeux publics côté GitHub Actions. La classification des clients reste locale.

## Résilience

Le contexte public est traité comme une donnée auxiliaire : API indisponible, page 403, timeout ou météo indisponible ne doivent jamais rendre l’analyse TGM inutilisable.

Le nouveau contexte est validé avant publication. En cas d’échec d’une source, le dernier contexte exploitable est conservé et l’interface affiche explicitement l’état de la source.

## Stockage local

IndexedDB peut conserver la session importée et des snapshots synthétiques d’analyse. Le bouton « Effacer les données locales » supprime ces éléments du navigateur concerné.

## Limites

Aucun logiciel ne peut garantir qu’une donnée TGM saisie incorrectement est vraie. Analysis Ultimate bloque les contradictions détectables et distingue faits, calculs, estimations et hypothèses.
