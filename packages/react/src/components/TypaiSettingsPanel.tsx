import type { ChangeEvent, ReactElement } from "react";

import type { TypaiSettingsPanelProps, TypaiUiSettings } from "../types";

const settingsFields = [
  ["autocorrect", "Autocorrect"],
  ["spellcheck", "Spellcheck"],
  ["keepCorrectionMarksVisible", "Keep correction marks visible"],
  ["usePersonalDictionary", "Use personal dictionary"],
] satisfies Array<[keyof TypaiUiSettings, string]>;

export function TypaiSettingsPanel({
  settings,
  onSettingsChange,
  onChange,
  label = "Typai settings",
}: TypaiSettingsPanelProps): ReactElement {
  const handleChange = (key: keyof TypaiUiSettings) => (event: ChangeEvent<HTMLInputElement>) => {
    const nextSettings = {
      ...settings,
      [key]: event.currentTarget.checked,
    };

    onSettingsChange?.(nextSettings);
    onChange?.(nextSettings);
  };

  return (
    <section aria-label={label} data-typai-react-settings-panel="true">
      {settingsFields.map(([key, fieldLabel]) => (
        <label key={key}>
          <input type="checkbox" checked={settings[key]} onChange={handleChange(key)} />
          <span>{fieldLabel}</span>
        </label>
      ))}
    </section>
  );
}
