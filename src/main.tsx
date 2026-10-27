import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./styles/tokens.css"
import "./styles/base.css"
import "./styles/ui.css"
import "./styles/layout.css"
import "./styles/components.css"
import "./styles/pages.css"
import "./styles/mobile.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
