# Le Noël de l'Élite

Site de la soirée de Noël de l'Élite, façon gazette imprimée. Il sert uniquement à **informer les participants** : modalités de la soirée, liste des convives, état du tirage, et la page « missive » que chacun ouvre avec son lien personnel. Le tirage lui-même se fait hors du site, avec `outils/tirage.mjs`.

Site 100 % statique (HTML / CSS / JavaScript, aucune dépendance, aucun serveur).

## Mise en ligne (GitHub Pages)

1. Dépôt GitHub → **Settings → Pages**
2. *Source* : `Deploy from a branch`, branche `main`, dossier `/ (root)`
3. Le site est publié sur `https://<compte>.github.io/Noel-de-l-Elite/`

Test en local : `python3 -m http.server` puis http://localhost:8000

## Ouverture du site

À chaque ouverture de la gazette, une carte de vœux pop-up s'ouvre : le Père Noël se dresse entre une lutine et une Mère Noël en pin-up (seins nus, tétons cachés par des têtes de lutin), lance un « oh oh oh » (enregistrement `audio/oh-oh-oh.mp3`) pendant que les pin-ups, d'abord habillées, jettent leur haut, puis se retourne, baisse son pantalon et lâche un pet : le son est un extrait de 5 s de « Prout de Noël » (`audio/prout-de-noel.mp3`, secondes 3 à 8, avec un léger fondu de sortie) ; si le fichier ne se charge pas, un pet synthétisé dans le navigateur prend le relais, pendant que trois rennes (sucre d'orge sous le ventre) volent en rond autour de la scène ; la neige qui en sort continue ensuite de tomber sur la gazette, en se déposant sur le haut de la page.

- Tout s'enchaîne seul, sans action : ouverture de la carte, Père Noël de face, demi-tour, pet (environ 5 s), puis la gazette.
- Les navigateurs bloquent le son tant qu'on n'a pas touché la page : un toucher n'importe où (ou une touche du clavier) l'active, sans changer le rythme. Un message l'indique tant que le son est coupé.
- « Passer » ou Échap pour sauter l'animation ; « Réécouter le message du Père Noël » en bas de page pour la rejouer.
- Pas d'ouverture sur les liens de révélation. Elle est jouée même si le téléphone a les animations réduites.

## Configuration : `js/config.js`

| Clé | Rôle |
|---|---|
| `evenement.date` | Date ISO (`"2026-12-20T19:30:00"`). `null` = compte à rebours vers le 25 décembre |
| `evenement.lieu`, `budget`, `tenue` | Affichés dans « Les modalités » et dans chaque missive. Vide = « à définir » |
| `participants` | Liste des convives, affichée sur le site (non modifiable depuis le site) |
| `exclusions` | Paires qui ne doivent pas se tirer, ex. `[["Camille", "Thomas"]]` (non affichées sur le site, mais lisibles dans ce fichier public) |
| `interdireEchangesCroises` | Empêche A → B **et** B → A |
| `secret` | Clé de brouillage des liens. **À changer avant le tirage, plus jamais après** |
| `tirage` | `{ effectue: true, date: "15 novembre" }` une fois les liens envoyés : la section « Le tirage au sort » l'annonce |

Les infos de la soirée (date, lieu, budget) peuvent être modifiées **après** le tirage : les missives les relisent depuis la config.

## Déroulé du tirage

1. **Configurer** `js/config.js` : `participants`, `exclusions`, `interdireEchangesCroises`, `secret`.
2. **Tirer au sort** (Node 18 ou plus récent) :
   ```
   node outils/tirage.mjs
   ```
   Le script affiche une ligne par convive, `Nom : lien`, **sans jamais afficher qui offre à qui**. Le résultat n'est enregistré nulle part : relancer le script refait un tirage complet (les anciens liens restent lisibles mais ne correspondent plus au nouveau tirage).
3. **Envoyer** à chacun son lien, en message privé.
4. Passer `tirage.effectue` à `true` dans la config et publier.
5. **Révélation** : chacun ouvre son lien, brise le sceau de cire et découvre à qui il offre un cadeau.

### Règles garanties par l'algorithme

- personne ne se tire soi-même ;
- chaque convive offre et reçoit exactement un cadeau ;
- les incompatibilités et (si activé) les échanges croisés sont respectés ;
- tirage **uniforme** (via `crypto.getRandomValues`) : toutes les répartitions valides sont équiprobables.

## À savoir

- **Confidentialité** : le nom du destinataire est brouillé dans le lien, après le `#`, qui n'est jamais transmis au serveur. C'est un brouillage, pas un chiffrement fort : un organisateur technique et déterminé pourrait décoder un lien. Pour un secret santa entre amis, c'est suffisant.
- Ne pas modifier `secret` après l'envoi des liens : ils deviendraient illisibles.
