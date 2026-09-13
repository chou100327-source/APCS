/* ================= 線條 icon（取代 emoji） ================= */
/* 一律 24x24、stroke=currentColor，跟著文字顏色走。用法：ICON("book", 18) */
const ICONS = {
  home:      `<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>`,
  book:      `<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H12v16H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H12v16h6.5A1.5 1.5 0 0 1 20 20.5z"/>`,
  quiz:      `<path d="M11 6h9"/><path d="M11 12h9"/><path d="M11 18h9"/><path d="M3 6l1.4 1.4L7.2 4.6"/><path d="M3 12l1.4 1.4L7.2 10.6"/><path d="M3 18l1.4 1.4L7.2 16.6"/>`,
  code:      `<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M14 4l-4 16"/>`,
  film:      `<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z" fill="currentColor" stroke="currentColor"/>`,
  target:    `<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>`,
  clock:     `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
  calendar:  `<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9h17"/><path d="M8 3v3.5"/><path d="M16 3v3.5"/>`,
  cap:       `<path d="M2 9.2 12 5l10 4.2L12 13.4z"/><path d="M6 11.2V16c0 1.2 2.7 2.6 6 2.6s6-1.4 6-2.6v-4.8"/><path d="M22 9.2V15"/>`,
  pencil:    `<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>`,
  bulb:      `<path d="M9.5 18h5"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.8 10.7c.8.7 1.3 1.4 1.3 2.3h5c0-.9.5-1.6 1.3-2.3A6 6 0 0 0 12 3z"/>`,
  upload:    `<path d="M12 15V4"/><path d="M7.5 8 12 3.5 16.5 8"/><path d="M5 20h14"/>`,
  reset:     `<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5V9H8"/>`,
  play:      `<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="currentColor"/>`,
  pause:     `<path d="M9 5v14"/><path d="M15 5v14"/>`,
  prev:      `<path d="M15 5l-7 7 7 7"/>`,
  next:      `<path d="M9 5l7 7-7 7"/>`,
  check:     `<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.6 2.6 4.6-5.2"/>`,
  x:         `<circle cx="12" cy="12" r="8.5"/><path d="M9.2 9.2l5.6 5.6"/><path d="M14.8 9.2l-5.6 5.6"/>`,
  warn:      `<path d="M12 3.5 21 19H3z"/><path d="M12 10v4.5"/><path d="M12 17.2h.01"/>`,
  flame:     `<path d="M12 3c.6 3.2 3.4 4.4 3.4 8a3.4 3.4 0 0 1-6.8 0c0-1.2.4-2 1.1-2.8.1 1.4 1.3 1.8 1.3.4C11 6.5 12 5.2 12 3z"/>`,
  chevron:   `<path d="M6 9.5l6 6 6-6"/>`,
  arrow:     `<path d="M5 12h13"/><path d="M12.5 6l6 6-6 6"/>`,
  circle:    `<circle cx="12" cy="12" r="7.5"/>`,
  dot:       `<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/>`,
  layers:    `<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/>`,
  route:     `<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.5"/>`,
};

function ICON(name, size) {
  const p = ICONS[name];
  if (!p) return "";
  const s = size || 18;
  return `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
