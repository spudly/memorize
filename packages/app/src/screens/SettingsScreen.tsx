import { useState } from "react";
import { MemorizeSettingsPage } from "@spudly/ui";
import type { MemorizeStore } from "@memorize/core";

type Props = {
  store: MemorizeStore;
};

/**
 * Settings tab host (#127, Drive sync removed in #96): the app
 * keeps the API-key state and store actions and hands display
 * state to the DS MemorizeSettingsPage, whose actions come back
 * as bare intents. At @spudly/ui 5.0.0 the page renders only the
 * Scripture source (API key) card — the Google Drive sync section
 * and all its props are gone from the page, and the app's Drive
 * wiring is deleted with it. Store readiness is gated in App,
 * above this screen, so there is no loading state here.
 */
export default function SettingsScreen({ store }: Props) {
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
