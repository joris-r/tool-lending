import { en } from "./en.js";
import { fr } from "./fr.js";

export const LANGUAGES = ["fr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "fr";

export interface Texts {
  appName: string;
  welcome: string;
  /** Label of the switch to this language, written in it. */
  switchTo: string;
  forbidden: string;
  malformed: string;
  notFound: string;
  internalError: string;
  backHome: string;
  /** The account link of the Home page, without and with a session. */
  signInLink: string;
  dashboardLink: string;
  signInTitle: string;
  signInFailed: string;
  loginLabel: string;
  passwordLabel: string;
  signInButton: string;
  signOutButton: string;
  /** The Volunteers page. */
  volunteersTitle: string;
  volunteersLink: string;
  newPasswordLabel: string;
  setPasswordButton: string;
  removeButton: string;
  addVolunteerHeading: string;
  addButton: string;
  volunteerAdded: (login: string) => string;
  passwordSet: (login: string) => string;
  volunteerRemoved: (login: string) => string;
  invalidVolunteer: string;
  loginTaken: (login: string) => string;
  unknownVolunteer: (login: string) => string;
  shortPassword: string;
  lastVolunteer: string;
  /** The Members page. */
  membersTitle: string;
  membersLink: string;
  emptyMembers: string;
  editLink: string;
  addMemberHeading: string;
  nameLabel: string;
  /** The contact label of the add form, with what it may hold. */
  contactHint: string;
  contactLabel: string;
  memberAdded: (name: string) => string;
  memberEdited: (name: string) => string;
  memberDeleted: (name: string) => string;
  invalidMember: string;
  memberTaken: (name: string) => string;
  /** The Member page. */
  saveButton: string;
  deleteMemberLink: string;
  /** The Member deletion page; the question is split around the name. */
  deletionTitle: string;
  deletionQuestion: readonly [string, string];
  confirmDeletion: string;
  cancelLink: string;
}

export const TEXTS: Record<Language, Texts> = { fr, en };

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    (LANGUAGES as readonly string[]).includes(value)
  );
}

export function otherLanguage(language: Language): Language {
  return language === "fr" ? "en" : "fr";
}
