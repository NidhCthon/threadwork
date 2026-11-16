// The right-click menu for cards and strings (SPEC.md 5.5). It sits in screen
// space rather than the canvas HUD so it stays the same size at any zoom.

let open = null;

const hex = (color) => `#${color.toString(16).padStart(6, "0")}`;

/**
 * A row of colour swatches: {swatches: [colours], current, action(colour|null)}.
 * The last button clears the colour back to the default.
 */
function swatchRow(item, close) {
  const row = document.createElement("div");
  row.className = "threadwork-swatches";
  const add = (color, label) => {
    const button = row.appendChild(document.createElement("button"));
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    if (color === null) button.classList.add("reset");
    else button.style.background = hex(color);
    if (color === item.current) button.classList.add("current");
    button.addEventListener("click", () => {
      close();
      item.action(color);
    });
  };
  for (const color of item.swatches) add(color, hex(color));
  add(null, item.resetLabel ?? "Default colour");
  return row;
}

/** Close the open menu, if any. */
export function closeMenu() {
  open?.close();
}

/**
 * A grid of emblems to pick from: {emblems: [{src, title}], current, action(src)}.
 * Each symbol is a CSS mask over the theme's text colour, so it reads on any
 * menu surface whatever colour the image itself is.
 */
function emblemGrid(item, close) {
  const grid = document.createElement("div");
  grid.className = "threadwork-emblems";
  for (const { src, title } of item.emblems) {
    const button = grid.appendChild(document.createElement("button"));
    button.type = "button";
    button.title = title;
    button.setAttribute("aria-label", title);
    if (src === item.current) button.classList.add("current");
    const symbol = button.appendChild(document.createElement("span"));
    // Foundry's file listing hands back paths already URL-encoded, so only
    // the quote that would end the url() string needs escaping.
    const url = `url("${src.replace(/"/g, "%22")}")`;
    symbol.style.maskImage = url;
    symbol.style.webkitMaskImage = url;
    button.addEventListener("click", () => {
      close();
      item.action(src);
    });
  }
  return grid;
}

/**
 * Show a menu at client coordinates. `items` are {label, icon, action} or the
 * string "-" for a divider. The menu closes on any choice, Escape, a click
 * elsewhere, or a wheel (which pans or zooms the board under it).
 */
export function showMenu({ x, y }, items, { title } = {}) {
  closeMenu();
  const menu = document.createElement("nav");
  menu.className = "threadwork-menu";
  menu.setAttribute("role", "menu");
  if (title) {
    const heading = menu.appendChild(document.createElement("header"));
    heading.textContent = title;
  }
  for (const item of items) {
    if (item === "-") {
      menu.appendChild(document.createElement("hr"));
      continue;
    }
    if (item.swatches) {
      menu.appendChild(swatchRow(item, () => close()));
      continue;
    }
    if (item.emblems) {
      menu.appendChild(emblemGrid(item, () => close()));
      continue;
    }
    const button = menu.appendChild(document.createElement("button"));
    button.type = "button";
    button.setAttribute("role", "menuitem");
    if (item.danger) button.classList.add("danger");
    if (item.current) button.classList.add("current");
    button.innerHTML = `<i class="${item.icon ?? "fa-solid fa-circle"}" inert></i><span></span>`;
    button.querySelector("span").textContent = item.label;
    button.addEventListener("click", () => {
      close();
      item.action();
    });
  }
  document.body.appendChild(menu);

  // Keep it on screen.
  const { innerWidth, innerHeight } = window;
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, innerWidth - rect.width - 8)}px`;
  menu.style.top = `${Math.min(y, innerHeight - rect.height - 8)}px`;

  const onPointer = (event) => { if (!menu.contains(event.target)) close(); };
  const onKey = (event) => { if (event.key === "Escape") close(); };
  const close = () => {
    if (open?.menu !== menu) return;
    open = null;
    menu.remove();
    document.removeEventListener("pointerdown", onPointer, true);
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("wheel", close, true);
  };
  // Listen from the next tick, so the right-click that opened it does not close it.
  setTimeout(() => {
    if (open?.menu !== menu) return;
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("wheel", close, true);
  });
  open = { menu, close };
  menu.querySelector("button")?.focus({ preventScroll: true });
  return menu;
}
