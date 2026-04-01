import DOMPurify from 'dompurify';

/** Contract HTML shown on the public quote page (standard + contract views). */
const CONTRACT_PROFILE = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'span', 'div'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
};

/**
 * Email-ish HTML for message threads rendered in a sandboxed iframe (internal + public quote).
 * Broader than contract text; still no script/style/on* handlers (DOMPurify strips those).
 */
const MESSAGE_BODY_IFRAME_PROFILE = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a',
    'h1', 'h2', 'h3', 'h4', 'span', 'div', 'img', 'blockquote',
    'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'colspan', 'rowspan'],
};

export function sanitizeContractHtml(html) {
  if (html == null || html === '') return '';
  return DOMPurify.sanitize(String(html), CONTRACT_PROFILE);
}

export function sanitizeMessageBodyHtml(html) {
  if (html == null || html === '') return '';
  return DOMPurify.sanitize(String(html), MESSAGE_BODY_IFRAME_PROFILE);
}
