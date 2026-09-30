// The theme's colours for the HTML parts of the board (the text editor and the
// right-click menu), published as CSS custom properties so the stylesheet
// holds no colours of its own. A second theme only has to be a second theme file.

const rgb = (color) => `${(color >> 16) & 255} ${(color >> 8) & 255} ${color & 255}`;

/** The custom properties for a theme: each colour as space-separated RGB, for rgb(... / alpha). */
export function themeProperties(theme) {
  const properties = {};
  for (const [name, color] of Object.entries(theme.ui)) properties[`--threadwork-${name}`] = rgb(color);
  return properties;
}

export function applyThemeCss(theme, root = globalThis.document?.documentElement) {
  if (!root) return;
  for (const [name, value] of Object.entries(themeProperties(theme))) root.style.setProperty(name, value);
}
