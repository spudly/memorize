import { useState } from "react";
import { MemorizeSettingsPage } from "@spudly/ui";
import type { MemorizeStore } from "@memorize/core";

type Props = {
  store: MemorizeStore;
};

/**
 * Settings tab host (#96): the API-key state and store actions
 * stay app-side and the DS MemorizeSettingsPage renders the
 * Scripture source card. At @spudly/ui 5.0.0 the page's Google
 * Drive sync section and all its props are removed (DS #424), and
 * the app's Drive wiring is deleted with it.
 */
export default function SettingsTab({ store }: Props) {
  const { apiKey } = store.getState();
  const [keyInput, setKeyInput] = useState(apiKey ?? "");

  const saveKey = (): void => {
    const key = keyInput.trim();
    if (key) {
      void store.actions.setApiKey(key);
    }
  };

  const clearKey = (): void => {
    setKeyInput("");
    void store.actions.clearApiKey();
  };

  return (
    <MemorizeSettingsPage
      apiKeyValue={keyInput}
      onApiKeyValueChange={setKeyInput}
      hasSavedApiKey={Boolean(apiKey)}
      onSaveApiKeyPress={saveKey}
      onClearApiKeyPress={clearKey}
    />
  );
}
