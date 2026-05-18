export type TypaiUiSettings = {
  autocorrect: boolean;
  spellcheck: boolean;
  keepCorrectionMarksVisible: boolean;
  usePersonalDictionary: boolean;
};

export type TypaiUiSettingsChange = {
  settings: TypaiUiSettings;
  changedKey: keyof TypaiUiSettings;
};

export type TypaiSettingsPanelHandle = {
  element: HTMLElement;
  update(settings: Partial<TypaiUiSettings>): void;
  destroy(): void;
};
