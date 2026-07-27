/**
 * Safe JSON-LD embedding.
 *
 * `JSON.stringify` escapes quotes and backslashes but NOT `<`, `>` or `&`. An
 * HTML parser ends a `<script>` block at the first literal `</script`, wherever
 * it appears — including inside a JSON string. So a post or exam title
 * containing `</script><img src=x onerror=alert(1)>` breaks out of the JSON-LD
 * block and becomes STORED XSS on a public, cacheable page.
 *
 * Escaping the three HTML-significant characters as `\uXXXX` keeps the JSON
 * semantically identical (search engines parse the same object) while making a
 * breakout impossible. U+2028/U+2029 are escaped too: they are valid inside
 * JSON strings but are line terminators in JavaScript source.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
