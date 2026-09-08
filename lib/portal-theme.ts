import type { PlatformSettings } from './types';

export const PORTAL_FONTS = ['Geist Sans', 'Inter', 'Source Sans 3'] as const;

const FONT_STACKS: Record<(typeof PORTAL_FONTS)[number], string> = {
  'Geist Sans':
    "'Geist Variable', 'Geist Sans', ui-sans-serif, system-ui, sans-serif",
  Inter: "'Inter Variable', Inter, ui-sans-serif, system-ui, sans-serif",
  'Source Sans 3':
    "'Source Sans 3 Variable', 'Source Sans 3', ui-sans-serif, system-ui, sans-serif",
};

export function portalFontStack(fontFamily: string) {
  return (
    FONT_STACKS[fontFamily as keyof typeof FONT_STACKS] ??
    FONT_STACKS['Geist Sans']
  );
}

export function portalThemeStyle(
  settings: Pick<PlatformSettings, 'primaryColor' | 'fontFamily'>,
) {
  return {
    '--portal-accent': settings.primaryColor,
    '--portal-accent-soft': `color-mix(in srgb, ${settings.primaryColor} 10%, white)`,
    '--portal-accent-ring': `color-mix(in srgb, ${settings.primaryColor} 30%, white)`,
    fontFamily: portalFontStack(settings.fontFamily),
  } as Record<string, string>;
}
