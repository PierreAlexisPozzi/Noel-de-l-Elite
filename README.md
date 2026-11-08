# Le Noël de l'Élite

Site de la soirée de Noël de l'Élite, façon gazette imprimée : modalités de la soirée, liste des convives et **tirage au sort du secret santa**.

Site 100 % statique (HTML / CSS / JavaScript, aucune dépendance, aucun serveur).

## Mise en ligne (GitHub Pages)

1. Dépôt GitHub → **Settings → Pages**
2. *Source* : `Deploy from a branch`, branche `main`, dossier `/ (root)`
3. Le site est publié sur `https://<compte>.github.io/Noel-de-l-Elite/`

Test en local : `python3 -m http.server` puis http://localhost:8000

## Ouverture du site

À chaque ouverture de la gazette, une carte de vœux pop-up s'ouvre : le Père Noël se dresse entre une lutine et une Mère Noël en pin-up (seins nus, tétons cachés par des têtes de lutin), nous regarde d'un air malicieux, se retourne, baisse son pantalon et lâche un pet : le son est un extrait de 3 s de « Prout de Noël » (`audio/prout-de-noel.mp3`, secondes 3 à 6, avec un léger fondu de sortie) ; si le fichier ne se charge pas, un pet synthétisé dans le navigateur prend le relais, et la neige qui en sort continue ensuite de tomber sur la gazette, en se déposant sur le haut de la page.

- Tout s'enchaîne seul, sans action : ouverture de la carte, Père Noël de face, demi-tour, pet (environ 5 s), puis la gazette.
- Les navigateurs bloquent le son tant qu'on n'a pas touché la page : un toucher n'importe où (ou une touche du clavier) l'active, sans changer le rythme. Un message l'indique tant que le son est coupé.
- « Passer » ou Échap pour sauter l'animation ; « Réécouter le message du Père Noël » en bas de page pour la rejouer.
- Pas d'ouverture sur les liens de révélation. Elle est jouée même si le téléphone a les animations réduites.

## Configuration : `js/config.js`

| Clé | Rôle |
|---|---|
| `evenement.date` | Date ISO (`"2026-12-20T19:30:00"`). `null` = compte à rebours vers le 25 décembre |
| `evenement.lieu`, `budget`, `tenue` | Affichés dans « Les modalités » et dans chaque missive. Vide = « à définir » |
| `participants` | Liste initiale des convives (facultatif : on peut aussi les saisir sur le site) |
| `exclusions` | Paires qui ne doivent pas se tirer, ex. `[["Camille", "Thomas"]]` |
| `interdireEchangesCroises` | Empêche A → B **et** B → A |
| `secret` | Clé de brouillage des liens. **À changer avant le tirage, plus jamais après** |

Les infos de la soirée (date, lieu, budget) peuvent être modifiées **après** le tirage : les missives les relisent depuis la config.

## Déroulé du tirage

1. **Convives** : saisir les noms (un ou plusieurs, séparés par des virgules) et les incompatibilités (couples).
2. **Tirage** : bouton « Procéder au tirage ». Le résultat n'est affiché à personne ; l'organisateur obtient une enveloppe fermée par convive.
3. **Envoi** : pour chaque enveloppe, « Copier le lien » ou « WhatsApp ». Chaque lien est personnel et marqué « Expédiée » une fois envoyé.
4. **Révélation** : chacun ouvre son lien, brise le sceau de cire et découvre à qui il offre un cadeau.

### Règles garanties par l'algorithme

- personne ne se tire soi-même ;
- chaque convive offre et reçoit exactement un cadeau ;
- les incompatibilités et (si activé) les échanges croisés sont respectés ;
- tirage **uniforme** (via `crypto.getRandomValues`) : toutes les répartitions valides sont équiprobables.

## À savoir

- **Le tirage est stocké dans le navigateur de l'organisateur** (localStorage). Faire le tirage depuis l'appareil avec lequel on enverra les liens ; vider les données du site efface le tirage (les liens déjà envoyés restent valables).
- **Confidentialité** : le nom du destinataire est brouillé dans le lien, après le `#`, qui n'est jamais transmis au serveur. C'est un brouillage, pas un chiffrement fort : un organisateur technique et déterminé pourrait décoder un lien. Pour un secret santa entre amis, c'est suffisant.
- Annuler le tirage rend tous les liens déjà envoyés caducs : il faut tout renvoyer.
