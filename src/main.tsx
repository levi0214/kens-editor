import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initFontSize } from "./fontSize";
import { initMaxWidth } from "./maxWidth";
import { initTheme } from "./theme";
import { initWrap } from "./wrap";
import { refreshVaultDocumentCount } from "./vault";

initFontSize();
initMaxWidth();
initWrap();
void refreshVaultDocumentCount();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

void initTheme();
