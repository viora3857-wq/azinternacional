import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { applyTheme, getThemePref, type ThemePref } from '../lib/theme';
import { RadioGroup } from './ui/RadioGroup';

export function ThemeSwitcher({ showLegend = false }: { showLegend?: boolean }) {
  const { t } = useTranslation();
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  return (
    <RadioGroup<ThemePref>
      legend={t('common.theme')}
      hideLegend={!showLegend}
      name="theme"
      segmented
      value={pref}
      onChange={(v) => {
        setPref(v);
        applyTheme(v);
      }}
      options={[
        { value: 'light', label: t('common.themeLight') },
        { value: 'dark', label: t('common.themeDark') },
        { value: 'system', label: t('common.themeSystem') },
      ]}
    />
  );
}
