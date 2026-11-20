/*
 * Configuration du Noël de l'Élite
 * --------------------------------
 * Modifiez ce fichier pour renseigner les informations de la soirée
 * et, une fois arrêtée, la liste des participants.
 */
window.NOEL_CONFIG = {
  edition: 2026,

  evenement: {
    // Format ISO : "2026-12-11" (jour seul) ou "2026-12-11T19:30:00" (avec l'heure).
    // null = compte à rebours vers le 25 décembre.
    date: "2026-12-11T19:30:00",
    lieu: "Vini Monte",
    budget: "20 €",
    tenue: "Pull de Noël de rigueur",
  },

  // Liste des convives, affichée sur le site (qui ne permet plus de la modifier).
  participants: [
    "Poolette", "Tibo", "Coralie", "PA", "Zoé", "Boris",
    "Laurie", "Arthur", "Alex", "Hugo", "Dani", "Mathis",
    "Ikram", "Vianney", "Mathilde", "Aurélien",
  ],

  // Paires qui ne doivent pas se tirer mutuellement (couples, etc.).
  // ex. [["Camille", "Thomas"]]
  exclusions: [
    ["Poolette", "Tibo"],
    ["Coralie", "PA"],
    ["Zoé", "Boris"],
    ["Laurie", "Arthur"],
    ["Dani", "Mathis"],
    ["Ikram", "Vianney"],
    ["Mathilde", "Aurélien"],
  ],

  // Interdit les échanges croisés (A offre à B ET B offre à A).
  interdireEchangesCroises: true,

  // État du tirage, affiché dans la section « Le tirage au sort ».
  // Le tirage se fait hors du site : node outils/tirage.mjs
  tirage: { effectue: false, date: "" },  // ex. { effectue: true, date: "15 novembre" }

  // Clé servant à brouiller les liens secrets. À changer une fois, AVANT le tirage :
  // la modifier après rend les liens déjà envoyés illisibles.
  secret: "elite-2026",
};
