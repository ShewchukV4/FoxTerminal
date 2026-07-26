(() => {
  const container = document.getElementById("cmd-groups");
  const search = document.getElementById("cmd-search");
  const countEl = document.getElementById("cmd-count");
  if (!container || !window.FOX_DATA) return;

  let total = 0;
  FOX_DATA.commandGroups.forEach((g) => { total += g.cmds.length; });

  function t(key, fallback = "") {
    const val = window.foxI18n?.t?.(key);
    return val && val !== key ? val : fallback;
  }

  function getDesc(c) {
    if (window.FOX_I18N_DATA?.cmds?.[c.name]) {
      return window.foxDesc(FOX_I18N_DATA.cmds, c.name, c.desc);
    }
    return c.desc;
  }

  function getGroupTitle(group) {
    const key = "grp." + group.id;
    const translated = t(key, "");
    return translated || group.title;
  }

  function buildCmdRow(c) {
    const row = document.createElement("div");
    row.className = "cmd-item";

    const name = document.createElement("strong");
    name.className = "mono";
    name.textContent = c.name;

    const body = document.createElement("div");
    body.className = "cmd-body";

    const usage = document.createElement("code");
    usage.textContent = c.usage;

    const desc = document.createElement("p");
    desc.className = "muted cmd-desc";
    desc.textContent = getDesc(c);

    body.appendChild(usage);
    body.appendChild(desc);

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy-mini";
    copy.dataset.copy = c.name;
    copy.textContent = t("ui.copy", "copy");

    row.appendChild(name);
    row.appendChild(body);
    row.appendChild(copy);
    return row;
  }

  function render(filter = "") {
    const q = filter.trim().toLowerCase();
    container.innerHTML = "";
    let visible = 0;
    const cmdWord = t("cmds.count", "команд");

    FOX_DATA.commandGroups.forEach((group) => {
      const cmds = group.cmds.filter((c) => {
        const d = getDesc(c).toLowerCase();
        return !q || c.name.includes(q) || c.usage.toLowerCase().includes(q) || d.includes(q);
      });
      if (!cmds.length) return;

      const section = document.createElement("section");
      section.className = "cmd-group reveal visible";

      const head = document.createElement("div");
      head.className = "cmd-group-head";

      const icon = document.createElement("span");
      icon.style.fontSize = "1.4rem";
      icon.textContent = group.icon;

      const title = document.createElement("h3");
      title.textContent = getGroupTitle(group);

      const count = document.createElement("span");
      count.className = "muted";
      count.style.fontSize = "0.8rem";
      count.textContent = cmds.length + " " + cmdWord;

      head.appendChild(icon);
      head.appendChild(title);
      head.appendChild(count);

      const list = document.createElement("div");
      list.className = "cmd-list";

      cmds.forEach((c) => {
        visible++;
        list.appendChild(buildCmdRow(c));
      });

      section.appendChild(head);
      section.appendChild(list);
      container.appendChild(section);
    });

    if (countEl) countEl.textContent = visible + " / " + total;
  }

  function boot() {
    render(search?.value || "");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  search?.addEventListener("input", () => render(search.value));
  document.addEventListener("foxlangchange", () => render(search?.value || ""));

  document.getElementById("cmd-random")?.addEventListener("click", () => {
    const all = FOX_DATA.commandGroups.flatMap((g) => g.cmds);
    const pick = all[Math.floor(Math.random() * all.length)];
    if (search) search.value = pick.name;
    render(pick.name);
    const tryLabel = window.foxI18n?.lang === "en" ? "Try: " : "Спробуй: ";
    window.foxShowToast?.(tryLabel + pick.usage);
  });
})();
