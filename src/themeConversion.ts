/**
 * VS Code theme color key → hm CSS custom property mapping.
 *
 * Sources consulted:
 * - github/github-vscode-theme (MIT): themes/github-light-default.json
 * - catppuccin/vscode (MIT): themes/catppuccin-latte.json
 * - Ethan Schoonover solarized-vscode (MIT): themes/solarized-light-color-theme.json
 * - dracula/visual-studio-code (MIT): themes/dracula.json
 *
 * Each entry maps the preferred VS Code color key to an hm semantic token.
 * Keys are tried in order; the first key present in the VS Code color object wins.
 */
export const VSCODE_TOKEN_MAP: Array<{ hmToken: string; vscodeKeys: string[] }> = [
  { hmToken: "--color-background", vscodeKeys: ["editor.background"] },
  { hmToken: "--color-mantle",     vscodeKeys: ["sideBar.background", "activityBar.background"] },
  { hmToken: "--color-crust",      vscodeKeys: ["panel.background", "statusBar.background"] },
  { hmToken: "--color-surface",    vscodeKeys: ["editor.selectionBackground", "list.activeSelectionBackground"] },
  { hmToken: "--color-surface-1",  vscodeKeys: ["tab.activeBackground", "editorGroupHeader.tabsBackground"] },
  { hmToken: "--color-surface-2",  vscodeKeys: ["scrollbarSlider.background", "editorWidget.background"] },
  { hmToken: "--color-overlay",    vscodeKeys: ["editorLineNumber.foreground"] },
  { hmToken: "--color-text",       vscodeKeys: ["editor.foreground"] },
  { hmToken: "--color-subtext",    vscodeKeys: ["descriptionForeground", "disabledForeground"] },
  { hmToken: "--color-subtext-1",  vscodeKeys: ["foreground"] },
  { hmToken: "--color-primary",    vscodeKeys: ["button.background", "activityBarBadge.background"] },
  { hmToken: "--color-on-primary", vscodeKeys: ["button.foreground"] },
  { hmToken: "--color-border",     vscodeKeys: ["panel.border", "editorGroup.border", "contrastBorder"] },
  { hmToken: "--color-focus",      vscodeKeys: ["focusBorder"] },
  { hmToken: "--color-green",      vscodeKeys: ["terminal.ansiGreen", "gitDecoration.addedResourceForeground"] },
  { hmToken: "--color-red",        vscodeKeys: ["errorForeground", "terminal.ansiRed"] },
  { hmToken: "--color-yellow",     vscodeKeys: ["terminal.ansiYellow", "editorWarning.foreground"] },
  { hmToken: "--color-mauve",      vscodeKeys: ["terminal.ansiMagenta"] },
  { hmToken: "--color-peach",      vscodeKeys: ["terminal.ansiRed", "gitDecoration.modifiedResourceForeground"] },
];

export type VscodeColors = Record<string, string>;
export type HmTokens = Record<string, string>;

/**
 * Convert a VS Code theme's `colors` object into hm CSS custom properties.
 * Only tokens present in VSCODE_TOKEN_MAP that have at least one matching key
 * in `vscodeColors` are included in the output.
 */
export function convertVscodeTheme(vscodeColors: VscodeColors): HmTokens {
  const result: HmTokens = {};
  for (const { hmToken, vscodeKeys } of VSCODE_TOKEN_MAP) {
    for (const key of vscodeKeys) {
      if (Object.prototype.hasOwnProperty.call(vscodeColors, key) && vscodeColors[key]) {
        result[hmToken] = vscodeColors[key];
        break;
      }
    }
  }
  return result;
}
