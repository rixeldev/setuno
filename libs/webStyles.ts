/**
 * Global document styles that only exist on the web.
 *
 * Metro resolves `@/libs/webStyles` to `webStyles.web.ts` when bundling for
 * the browser, so the native build never touches the DOM.
 */
export function installWebDocumentStyles(): void {
  // Native platforms render real text fields, which already own their focus
  // indicator, so there is nothing to install here.
}
