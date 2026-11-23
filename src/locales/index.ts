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
