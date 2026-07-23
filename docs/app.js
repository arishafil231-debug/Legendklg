const API = "https://legendy-kalugi.kibervagonetkaalekse.chatgpt.site/api/entries";
const sections = [
  ["legends", "Легенды", "Городские предания, слухи и истории, которые передают из уст в уста.", "Например: говорят, что в старом доме на Воскресенской…"],
  ["history", "История", "События, места и люди, из которых складывается летопись города.", "Например: в этом здании до революции находилась…"],
  ["identity", "Идентичность", "Что делает Калугу Калугой: слова, привычки, места и характер.", "Например: для меня Калуга — это…"],
  ["made", "Сделано в Калуге", "Люди, мастерские, продукты и идеи, созданные здесь.", "Например: название проекта, мастерской или инициативы…"],
];

let active = "legends";
let entries = [];
let editing = null;
const $ = (selector) => document.querySelector(selector);
const authors = ["Алёна", "Даниил", "Владимир", "Арина", "Михаил", "Филипп"];
const current = () => sections.find(([id]) => id === active);
const setStatus = (text = "") => { $("#status").textContent = text; };

function setupAuthorControl() {
  const form = $("#entryForm");
  const submit = form.querySelector('button[type="submit"], button:not([type])');
  submit.classList.add("confirm-entry");
  submit.textContent = "✓";
  const control = document.createElement("div");
  control.className = "author-control";
  const label = document.createElement("label");
  label.htmlFor = "entryAuthor";
  label.textContent = "Кто сделал этот проект";
  const select = document.createElement("select");
  select.id = "entryAuthor";
  authors.forEach((person) => {
    const option = document.createElement("option");
    option.value = person;
    option.textContent = person;
    select.append(option);
  });
  control.append(label, select);
  form.querySelector("small").before(control);
}

async function api(method, body) {
  const url = method === "DELETE" ? `${API}?id=${body.id}` : API;
  const response = await fetch(url, {
    method,
    headers: body && method !== "DELETE" ? { "Content-Type": "application/json" } : {},
    body: body && method !== "DELETE" ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}

function renderTabs() {
  const tabs = $("#tabs");
  tabs.replaceChildren();
  sections.forEach(([id, title]) => {
    const button = document.createElement("button");
    button.textContent = title;
    button.className = id === active ? "active" : "";
    button.onclick = () => { active = id; editing = null; render(); };
    tabs.append(button);
  });
}

function renderEntries() {
  const list = $("#entries");
  const visible = entries.filter((entry) => entry.section === active);
  $("#count").textContent = `${visible.length} ${visible.length === 1 ? "запись" : "записей"}`;
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = "<span>✦</span><p>Здесь пока тихо.</p><small>Оставьте первую запись в этом разделе.</small>";
    list.append(empty);
    return;
  }
  visible.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "entry";
    if (editing === entry.id) {
      const row = document.createElement("div");
      row.className = "edit";
      const area = document.createElement("textarea");
      area.maxLength = 500;
      area.value = entry.content;
      const save = document.createElement("button");
      save.textContent = "Сохранить";
      save.onclick = () => saveEdit(entry.id, area.value);
      const cancel = document.createElement("button");
      cancel.textContent = "Отмена";
      cancel.onclick = () => { editing = null; renderEntries(); };
      row.append(area, save, cancel);
      article.append(row);
    } else {
      const text = document.createElement("p");
      text.textContent = entry.content;
      const footer = document.createElement("div");
      footer.className = "entry-foot";
      const date = document.createElement("time");
      date.textContent = new Date(entry.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
      const actions = document.createElement("span");
      const edit = document.createElement("button");
      edit.textContent = "Изменить";
      edit.onclick = () => { editing = entry.id; renderEntries(); };
      const remove = document.createElement("button");
      remove.textContent = "Удалить";
      remove.onclick = () => deleteEntry(entry.id);
      actions.append(edit, remove);
      const meta = document.createElement("span");
      meta.className = "entry-meta";
      meta.append(date);
      if (entry.author) {
        const author = document.createElement("span");
        author.className = "author-chip";
        author.textContent = entry.author;
        meta.append(author);
      }
      footer.append(meta, actions);
      article.append(text, footer);
    }
    list.append(article);
  });
}

function render() {
  const [, title, description, prompt] = current();
  $("#sectionTitle").textContent = title;
  $("#sectionDescription").textContent = description;
  $("#newEntry").placeholder = prompt;
  renderTabs();
  renderEntries();
}

async function load() {
  setStatus("Загружаем городскую память…");
  try {
    entries = (await api("GET")).entries;
    setStatus();
    render();
  } catch {
    setStatus("Не удалось загрузить записи. Обновите страницу.");
  }
}

async function saveEdit(id, value) {
  const content = value.trim();
  if (!content) return;
  try {
    await api("PATCH", { id, content });
    entries = entries.map((entry) => entry.id === id ? { ...entry, content } : entry);
    editing = null;
    setStatus("Изменения сохранены");
    renderEntries();
  } catch { setStatus("Не удалось сохранить изменения."); }
}

async function deleteEntry(id) {
  if (!confirm("Удалить эту запись?")) return;
  try {
    await api("DELETE", { id });
    entries = entries.filter((entry) => entry.id !== id);
    setStatus("Запись удалена");
    renderEntries();
  } catch { setStatus("Не удалось удалить запись."); }
}

$("#entryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const area = $("#newEntry");
  const content = area.value.trim();
  if (!content) return;
  try {
    const author = $("#entryAuthor").value;
    const { entry } = await api("POST", { section: active, content, author });
    entries.unshift(entry);
    area.value = "";
    setStatus("Запись добавлена");
    renderEntries();
  } catch { setStatus("Не удалось сохранить. Попробуйте ещё раз."); }
});

const audio = $("#ambient");
const sound = $("#soundToggle");
audio.volume = 0.55;
function setSound(on) {
  sound.classList.toggle("is-on", on);
  sound.classList.toggle("is-off", !on);
  sound.setAttribute("aria-pressed", String(on));
  sound.setAttribute("aria-label", on ? "Выключить звук" : "Включить звук");
  if (on) audio.play().catch(() => setSound(false)); else audio.pause();
}
audio.play().then(() => setSound(true)).catch(() => setSound(false));
sound.onclick = () => setSound(audio.paused);

$("#openProject").onclick = () => {
  if (audio.paused) setSound(true);
  const cover = $("#cover");
  cover.classList.add("leaving");
  setTimeout(() => {
    cover.classList.add("hidden");
    $("#project").classList.remove("hidden");
    $("#project").setAttribute("aria-hidden", "false");
  }, 560);
};
$("#back").onclick = () => {
  $("#project").classList.add("hidden");
  $("#project").setAttribute("aria-hidden", "true");
  $("#cover").classList.remove("hidden", "leaving");
};

setupAuthorControl();
render();
load();
