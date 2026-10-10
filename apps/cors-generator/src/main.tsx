import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@komikhq/ui/globals.css";
import { App } from "./App";
import { ThemeProvider } from "./components/theme-provider";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("The app root element is missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
