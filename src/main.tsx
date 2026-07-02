import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initFontSize } from "./fontSize";
import { initTheme } from "./theme";
import { initWrap } from "./wrap";

initFontSize();
initWrap();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

void initTheme();
