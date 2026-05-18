import type { TypaiSettingsPanelHandle, TypaiUiSettings, TypaiUiSettingsChange } from "./types";

export type CreateSettingsPanelOptions = {
  ownerDocument?: Document;
  parent?: HTMLElement;
  settings: TypaiUiSettings;
  onChange(change: TypaiUiSettingsChange): void;
};

const settingFields = [
  {
    key: "autocorrect",
    label: "Autocorrect",
  },
  {
    key: "spellcheck",
    label: "Spellcheck",
  },
  {
    key: "keepCorrectionMarksVisible",
    label: "Keep correction marks visible",
  },
  {
    key: "usePersonalDictionary",
    label: "Use personal dictionary",
  },
] satisfies Array<{ key: keyof TypaiUiSettings; label: string }>;

export function createSettingsPanel(options: CreateSettingsPanelOptions): TypaiSettingsPanelHandle {
  const ownerDocument = resolveOwnerDocument(options.ownerDocument, options.parent);
  const element = ownerDocument.createElement("section");
  let settings = { ...options.settings };

  element.className = "typai-ui-settings-panel";
  element.setAttribute("aria-label", "Typai settings");
  element.setAttribute("data-typai-ui-settings-panel", "true");

  const heading = ownerDocument.createElement("h2");
  heading.className = "typai-ui-settings-title";
  heading.textContent = "Typai settings";
  element.appendChild(heading);

  for (const field of settingFields) {
    element.appendChild(
      createSettingControl(ownerDocument, field.key, field.label, settings[field.key]),
    );
  }

  const onChange = (event: Event) => {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }

    const key = event.target.dataset.typaiSetting as keyof TypaiUiSettings | undefined;

    if (!isSettingKey(key)) {
      return;
    }

    settings = {
      ...settings,
      [key]: event.target.checked,
    };
    options.onChange({
      settings: { ...settings },
      changedKey: key,
    });
  };

  element.addEventListener("change", onChange);
  options.parent?.appendChild(element);

  return {
    element,
    update(nextSettings) {
      settings = {
        ...settings,
        ...nextSettings,
      };
      syncInputs(element, settings);
    },
    destroy() {
      element.removeEventListener("change", onChange);
      element.remove();
    },
  };
}

function createSettingControl(
  ownerDocument: Document,
  key: keyof TypaiUiSettings,
  label: string,
  checked: boolean,
): HTMLLabelElement {
  const wrapper = ownerDocument.createElement("label");
  const input = ownerDocument.createElement("input");
  const text = ownerDocument.createElement("span");

  wrapper.className = "typai-ui-setting";
  input.type = "checkbox";
  input.checked = checked;
  input.dataset.typaiSetting = key;
  text.textContent = label;

  wrapper.appendChild(input);
  wrapper.appendChild(text);

  return wrapper;
}

function syncInputs(element: HTMLElement, settings: TypaiUiSettings): void {
  for (const field of settingFields) {
    const input = element.querySelector<HTMLInputElement>(`[data-typai-setting="${field.key}"]`);

    if (input !== null) {
      input.checked = settings[field.key];
    }
  }
}

function isSettingKey(key: string | undefined): key is keyof TypaiUiSettings {
  return settingFields.some((field) => field.key === key);
}

function resolveOwnerDocument(
  ownerDocument: Document | undefined,
  parent: HTMLElement | undefined,
): Document {
  const resolved = ownerDocument ?? parent?.ownerDocument ?? globalThis.document;

  if (resolved === undefined) {
    throw new Error("@typai/ui requires a DOM Document.");
  }

  return resolved;
}
