/**
 * For GitHub Pages project sites, set EXPO_BASE_URL to /{repo-name} in CI
 * (no trailing slash). Omitted or "/" for local dev.
 */
module.exports = ({ config }) => {
  const raw = (process.env.EXPO_BASE_URL || '').trim();
  const baseUrl =
    raw && raw !== '/'
      ? raw.replace(/\/$/, '')
      : undefined;

  return {
    ...config,
    experiments: {
      ...config.experiments,
      ...(baseUrl ? { baseUrl } : {}),
    },
    web: {
      ...config.web,
      ...(baseUrl
        ? {
            scope: `${baseUrl}/`,
            startUrl: `${baseUrl}/`,
          }
        : {}),
    },
  };
};
