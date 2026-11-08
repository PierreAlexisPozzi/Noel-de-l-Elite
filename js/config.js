/*
 * Configuration du Noël de l'Élite
 * --------------------------------
 * Modifiez ce fichier pour renseigner les informations de la soirée
 * et, une fois arrêtée, la liste des participants.
 */
window.NOEL_CONFIG = {
  edition: 2026,

  evenement: {
    // Format ISO, ex. "2026-12-20T19:30:00". Laisser null tant que la date n'est pas fixée
    // (le compte à rebours vise alors le 25 décembre).
    date: null,
    lieu: "",            // ex. "Chez Pierre-Alexis, Paris 11e"
    budget: "",          // ex. "30 €"
    tenue: "Pull de Noël de rigueur",
  },

  // Liste initiale des convives (peut aussi être saisie directement sur le site).
  // ex. ["Pierre-Alexis", "Camille", "Thomas", "Léa"]
  participants: [],

  // Paires qui ne doivent pas se tirer mutuellement (couples, etc.).
  // ex. [["Camille", "Thomas"]]
  exclusions: [],

  // Interdit les échanges croisés (A offre à B ET B offre à A).
  interdireEchangesCroises: true,

  // Clé servant à brouiller les liens secrets. À changer une fois, AVANT le tirage :
  // la modifier après rend les liens déjà envoyés illisibles.
  secret: "elite-2026",
};
