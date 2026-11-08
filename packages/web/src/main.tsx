import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { activateForClient } from "./locales/i18n";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

// Activate the resolved locale (stored choice > Accept-Language /
// navigator.languages > en-US, #110) before first render so the
// initial paint is already localized. Activation is dynamic-import
// based and isomorphic — see src/locales/i18n.ts.
void activateForClient().then(() => {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
