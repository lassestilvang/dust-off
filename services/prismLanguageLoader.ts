const loadedLanguages = new Set<string>(['javascript']);

const prismLanguageLoaders: Record<string, () => Promise<unknown>> = {
  typescript: () => import('prismjs/components/prism-typescript'),
  jsx: () => import('prismjs/components/prism-jsx'),
  tsx: async () => {
    await import('prismjs/components/prism-typescript');
    await import('prismjs/components/prism-jsx');
    return import('prismjs/components/prism-tsx');
  },
  css: () => import('prismjs/components/prism-css'),
  json: () => import('prismjs/components/prism-json'),
  python: () => import('prismjs/components/prism-python'),
  java: () => import('prismjs/components/prism-java'),
  go: () => import('prismjs/components/prism-go'),
  rust: () => import('prismjs/components/prism-rust'),
  bash: () => import('prismjs/components/prism-bash'),
  markdown: () => import('prismjs/components/prism-markdown'),
};

export const ensurePrismLanguage = async (language: string): Promise<void> => {
  if (loadedLanguages.has(language)) {
    return;
  }

  const loadLanguage = prismLanguageLoaders[language];
  if (!loadLanguage) {
    return;
  }

  await loadLanguage();
  loadedLanguages.add(language);
};
