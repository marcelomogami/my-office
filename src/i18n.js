import locales from './locales.json' with { type: 'json' };

// Textos da interface em vários idiomas, num arquivo só (locales.json), lido
// também pelo dock. O idioma vem do config.json local ("language"); o padrão
// é inglês, e um texto que falte no idioma escolhido cai no inglês.

export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGES = Object.keys(locales);

// Código do idioma como está em locales.json, sem diferenciar maiúsculas
// ("pt-br" vira "pt-BR"); null se não houver tradução para ele.
export function normalizeLanguage(code) {
  if (typeof code !== 'string') return null;
  return LANGUAGES.find((lang) => lang.toLowerCase() === code.trim().toLowerCase()) ?? null;
}

// Função de tradução: t('status.working').
export function translator(language = DEFAULT_LANGUAGE) {
  const chosen = locales[normalizeLanguage(language) ?? DEFAULT_LANGUAGE];
  const fallback = locales[DEFAULT_LANGUAGE];
  return (key) => chosen[key] ?? fallback[key] ?? key;
}
