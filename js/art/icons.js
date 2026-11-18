// Symbole als SVG-Sprite (24×24, Linien). Einmal ins Dokument einsetzen, dann mit icon('name') verwenden.
// Das Zahnrad folgt der Form von Feather Icons (MIT-Lizenz).

const P = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sofa: '<path d="M5 10.5V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2.5"/><path d="M3 12.5a2 2 0 0 1 4 0V14h10v-1.5a2 2 0 0 1 4 0V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M6 19v1.8M18 19v1.8"/>',
  remote: '<path d="M12 16.2l-2.6-2.4C7.9 12.4 7.2 11.6 7.2 10.5A2 2 0 0 1 9.2 8.4c.8 0 1.5.4 1.9.9l.9.9.9-.9c.4-.5 1.1-.9 1.9-.9a2 2 0 0 1 2 2.1c0 1.1-.7 1.9-2.2 3.3z"/><path d="M4.9 6.4a8.2 8.2 0 0 0 0 11.2M19.1 6.4a8.2 8.2 0 0 1 0 11.2"/><path d="M2.3 3.8a12 12 0 0 0 0 16.4M21.7 3.8a12 12 0 0 1 0 16.4"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="8.5" cy="8.5" r="1.3" class="f"/><circle cx="15.5" cy="15.5" r="1.3" class="f"/><circle cx="12" cy="12" r="1.3" class="f"/><circle cx="15.5" cy="8.5" r="1.3" class="f"/><circle cx="8.5" cy="15.5" r="1.3" class="f"/>',
  pencil: '<path d="M4 20h4.2L19.3 8.9a2.1 2.1 0 0 0 0-3l-1.2-1.2a2.1 2.1 0 0 0-3 0L4 15.8z"/><path d="M13.5 6.5l4 4"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.6M6.2 6.3C3.6 8 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 4.9-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cross: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  maybe: '<path d="M4 12c2.5-3 5-3 8 0s5.5 3 8 0"/>',
  question: '<circle cx="12" cy="12" r="9.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.1-2.5 3.7"/><circle cx="12" cy="17.1" r=".9" class="f"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  soundon: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4M18.3 6a8.5 8.5 0 0 1 0 12"/>',
  soundoff: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  crown: '<path d="M3 8l4.6 4L12 5l4.4 7L21 8l-2 11H5z"/><path d="M5.6 15.5h12.8"/>',
  heart: '<path d="M12 20.3l-1.3-1.2C6 14.9 3 12.2 3 8.8 3 6.2 5.1 4 7.7 4c1.6 0 3.2.8 4.3 2 1.1-1.2 2.7-2 4.3-2C18.9 4 21 6.2 21 8.8c0 3.4-3 6.1-7.7 10.3z"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  sparkle: '<path d="M12 2.5c.8 4.6 2.9 6.7 7.5 7.5-4.6.8-6.7 2.9-7.5 7.5-.8-4.6-2.9-6.7-7.5-7.5 4.6-.8 6.7-2.9 7.5-7.5z"/><path d="M19 15.5c.3 1.7 1.1 2.5 2.8 2.8-1.7.3-2.5 1.1-2.8 2.8-.3-1.7-1.1-2.5-2.8-2.8 1.7-.3 2.5-1.1 2.8-2.8z"/>',
  swap: '<path d="M7 4L3.5 7.5 7 11"/><path d="M3.5 7.5H17a3.5 3.5 0 0 1 3.5 3.5"/><path d="M17 20l3.5-3.5L17 13"/><path d="M20.5 16.5H7A3.5 3.5 0 0 1 3.5 13"/>',
  flag: '<path d="M5 21V4.5"/><path d="M5 4.5h11.5l-2.2 4.2 2.2 4.3H5"/>',
  send: '<path d="M21 3L10.2 13.8"/><path d="M21 3l-6.8 18-4-7.2L3 9.8z"/>',
  info: '<circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".9" class="f"/>',
  wand: '<path d="M4 20L15 9"/><path d="M13 7l4 4"/><path d="M18.5 2.5v3M17 4h3M20.5 9.5v2M19.5 10.5h2M8.5 3.5v2M7.5 4.5h2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a2.5 2.5 0 0 0 3 4M16 6h3a2.5 2.5 0 0 1-3 4"/><path d="M12 13v4M8.5 20.5h7M9.5 20.5l.5-3.5h4l.5 3.5"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
  refresh: '<path d="M20 11.5A8 8 0 0 0 5.6 7M4 12.5A8 8 0 0 0 18.4 17"/><path d="M5 3v4.5h4.5M19 21v-4.5h-4.5"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  offline: '<path d="M2 8.8a15 15 0 0 1 4.1-2.6M10 5.1A15 15 0 0 1 22 8.8M5 12.4a10 10 0 0 1 4.2-2.3M15.4 10.6a10 10 0 0 1 3.6 1.8M8.6 15.9a5 5 0 0 1 6.8 0"/><circle cx="12" cy="19.3" r=".9" class="f"/><path d="M3 3l18 18"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15.5" r="1.3" class="f"/>',
  chat: '<path d="M4 5.5h16v10.5H10l-5 4v-4H4z"/>',
  grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" class="f"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.8 1.8-1.6 0-.5-.2-.9-.5-1.3a1.6 1.6 0 0 1 1.2-2.7H16a5 5 0 0 0 5-5C21 6.4 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2" class="f"/><circle cx="10" cy="7" r="1.2" class="f"/><circle cx="14.5" cy="7" r="1.2" class="f"/>',
  motion: '<path d="M3 12h4M5 8h6M5 16h6"/><circle cx="16.5" cy="12" r="4.5"/>',
  vibrate: '<rect x="7.5" y="3.5" width="9" height="17" rx="2.5"/><path d="M3.5 9v6M20.5 9v6"/>',
  poke: '<path d="M9 11V5.6a1.6 1.6 0 0 1 3.2 0V10"/><path d="M12.2 9.5a1.6 1.6 0 0 1 3.2 0v1.2a1.6 1.6 0 0 1 3.2 0V15a6 6 0 0 1-6 6h-.4a6 6 0 0 1-4.6-2.2l-2.9-3.6a1.6 1.6 0 0 1 2.4-2.1L9 15"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
};

export function iconSprite() {
  const syms = Object.entries(P)
    .map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
<style>.f{fill:currentColor;stroke:none}</style>${syms}</svg>`;
}

// <svg class="ic"><use href="#i-name"/></svg>
export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
}
