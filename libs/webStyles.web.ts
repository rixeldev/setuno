/**
 * Global document styles for the web build.
 *
 * React Native Web renders real `<input>` / `<textarea>` elements and never
 * suppresses the browser's own focus ring, so every field picked up a second,
 * white outline on top of the themed focus border (docs §21). The rule below
 * clears it once for the whole app instead of per component.
 */
const STYLE_ID = "stagebook-document-styles"

const DOCUMENT_CSS = [
  // The field keeps its own focus treatment (border colour, pressed states);
  // only the user-agent ring is removed.
  "input:focus, textarea:focus, select:focus, button:focus { outline: none; }",
].join("\n")

export function installWebDocumentStyles(): void {
  if (typeof document === "undefined") return
  if (document.getElementById(STYLE_ID) !== null) return

  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = DOCUMENT_CSS
  document.head.appendChild(style)
}
