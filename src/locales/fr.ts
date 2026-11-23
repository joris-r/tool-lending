import type { Texts } from "./index.js";

export const fr: Texts = {
  appName: "Prêt d'outils",
  welcome:
    "Prêt d'outils permet aux associations de quartier de prêter des outils à leurs membres, et à tout le monde de consulter ce qu'elles prêtent.",
  switchTo: "Français",
  forbidden: "Cette requête vient d'un autre site : elle est refusée.",
  malformed: "Cette requête est invalide.",
  notFound: "Cette page n'existe pas.",
  internalError: "Une erreur interne est survenue.",
  backHome: "Retour à l'accueil",
  signInLink: "Se connecter",
  dashboardLink: "Tableau de bord",
  signInTitle: "Connexion",
  signInFailed:
    "Identifiant ou mot de passe incorrect, ou trop de tentatives : attendez quelques minutes et réessayez.",
  loginLabel: "Identifiant",
  passwordLabel: "Mot de passe",
  signInButton: "Se connecter",
  signOutButton: "Se déconnecter",
  volunteersTitle: "Bénévoles",
  volunteersLink: "Bénévoles",
  newPasswordLabel: "Nouveau mot de passe",
  setPasswordButton: "Changer le mot de passe",
  removeButton: "Retirer",
  addVolunteerHeading: "Ajouter un bénévole",
  addButton: "Ajouter",
  volunteerAdded: (login) => `${login} a été ajouté aux bénévoles.`,
  passwordSet: (login) => `Le mot de passe de ${login} a été changé.`,
  volunteerRemoved: (login) => `${login} a été retiré des bénévoles.`,
  invalidVolunteer:
    "L'identifiant ne doit être ni vide ni contenir d'espace, et le mot de passe doit compter au moins 12 caractères.",
  loginTaken: (login) => `L'identifiant ${login} est déjà pris.`,
  unknownVolunteer: (login) =>
    `${login} n'est pas un bénévole de votre association.`,
  shortPassword: "Le mot de passe doit compter au moins 12 caractères.",
  lastVolunteer:
    "Le seul bénévole de l'association ne peut pas être retiré : ajoutez-en un autre d'abord.",
};
