const API = "https://legendy-kalugi.kibervagonetkaalekse.chatgpt.site/api/entries";
const API_ORIGIN = new URL(API).origin;
const sections = [
  ["legends", "Легенды", "Городские предания, слухи и истории, которые передают из уст в уста.", "Например: говорят, что в старом доме на Воскресенской…"],
  ["history", "История", "События, места и люди, из которых складывается летопись города.", "Например: в этом здании до революции находилась…"],
  ["identity", "Идентичность", "Что делает Калугу Калугой: слова, привычки, места и характер.", "Например: для меня Калуга — это…"],
  ["made", "Сделано в Калуге", "Люди, мастерские, продукты и идеи, созданные здесь.", "Например: название проекта, мастерской или инициативы…"],
];
const authors = ["Алёна", "Даниил", "Владимир", "Арина", "Михаил", "Филипп"];
const videoExtensions = /\.(mp4|m4v|mov|webm|avi)$/i;

let active = "legends";
let entries = [];
let editing = null;
let uploadingId = null;
const $ = (selector) => document.querySelector(selector);
const current = () => sections.find(([id]) => id === active);
const setStatus = (text = "") => { $("#status").textContent = text; };
const withVideoUrl = (entry) => entry.videoUrl ? { ...entry, videoUrl: `${API_ORIGIN}${entry.videoUrl}` } : entry;

async function uploadResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: response.status === 413 ? "Сервер отклонил слишком большой фрагмент видео." : "Сервер не смог обработать загрузку видео." };
  }
}

function setupAuthorControl() {
  const form = $("#entryForm");
  const submit = form.querySelector('button[type="submit"], button:not([type])');
  submit.classList.add("confirm-entry");
  submit.textContent = "✓";
  form.querySelector("label[for='newEntry']").textContent = "Название записи";

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

function uploadControl(entry) {
  const label = document.createElement("label");
  label.className = `video-upload${uploadingId === entry.id ? " is-uploading" : ""}`;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "video/*";
  input.disabled = uploadingId !== null;
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) void uploadVideo(entry.id, file);
    input.value = "";
  };
  label.append(input, document.createTextNode(uploadingId === entry.id ? "Загрузка…" : entry.hasVideo ? "Заменить видео" : "Прикрепить видео"));
  return label;
}

function renderEntries() {
  const list = $("#entries");
  const visible = entries
    .filter((entry) => entry.section === active)
    .sort((a, b) => a.content.localeCompare(b.content, "ru", { sensitivity: "base" }));
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
    article.className = "entry project-entry";
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
      const title = document.createElement("h3");
      title.textContent = entry.content;
      const footer = document.createElement("div");
      footer.className = "entry-foot";
      const meta = document.createElement("span");
      meta.className = "entry-meta";
      const madeBy = document.createElement("span");
      madeBy.className = "made-by";
      madeBy.textContent = "Сделал(а)";
      meta.append(madeBy);
      if (entry.author) {
        const author = document.createElement("span");
        author.className = "author-chip";
        author.textContent = entry.author;
        meta.append(author);
      }
      footer.append(meta);

      const videoArea = document.createElement("div");
      videoArea.className = "video-area";
      if (entry.hasVideo && entry.videoUrl) {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.src = entry.videoUrl;
        video.onmouseenter = () => { void video.play().catch(() => undefined); };
        video.onmouseleave = () => {
          video.pause();
          video.currentTime = 0;
        };
        videoArea.append(video);
      } else {
        const noVideo = document.createElement("p");
        noVideo.textContent = "Видеофайлов пока нет";
        videoArea.append(noVideo);
      }

      const actions = document.createElement("div");
      actions.className = "entry-actions";
      const textActions = document.createElement("span");
      const edit = document.createElement("button");
      edit.textContent = "Изменить";
      edit.onclick = () => { editing = entry.id; renderEntries(); };
      const remove = document.createElement("button");
      remove.textContent = "Удалить";
      remove.onclick = () => deleteEntry(entry.id);
      textActions.append(edit, remove);
      actions.append(uploadControl(entry), textActions);
      article.append(title, footer, videoArea, actions);
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
    entries = (await api("GET")).entries.map(withVideoUrl);
    setStatus();
    render();
  } catch {
    setStatus("Не удалось загрузить записи. Обновите страницу.");
  }
}

async function uploadVideo(id, file) {
  if (!(file.type.startsWith("video/") || videoExtensions.test(file.name))) {
    setStatus("Поддерживаются видео MP4, MOV, WebM, M4V и AVI.");
    return;
  }
  if (file.size > 100 * 1024 * 1024) {
    setStatus("Размер видео не должен превышать 100 МБ.");
    return;
  }
  uploadingId = id;
  setStatus("Загружаем видео…");
  renderEntries();
  try {
    const startResponse = await fetch(`${API_ORIGIN}/api/videos?upload=start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: id, name: file.name, type: file.type, size: file.size }),
    });
    const start = await uploadResponse(startResponse);
    if (!startResponse.ok || !start.key || !start.uploadId) throw new Error(start.error ?? "Не удалось начать загрузку видео.");

    const chunkSize = 6 * 1024 * 1024;
    const parts = [];
    for (let offset = 0, partNumber = 1; offset < file.size; offset += chunkSize, partNumber += 1) {
      const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
      const response = await fetch(`${API_ORIGIN}/api/videos?upload=part&key=${encodeURIComponent(start.key)}&uploadId=${encodeURIComponent(start.uploadId)}&partNumber=${partNumber}`, {
        method: "POST",
        body: chunk,
      });
      const part = await uploadResponse(response);
      if (!response.ok || !part.etag || !part.partNumber) throw new Error(part.error ?? "Не удалось загрузить фрагмент видео.");
      parts.push({ partNumber: part.partNumber, etag: part.etag });
      setStatus(`Загружаем видео… ${Math.round(Math.min(offset + chunkSize, file.size) / file.size * 100)}%`);
    }

    const completeResponse = await fetch(`${API_ORIGIN}/api/videos?upload=complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: id, key: start.key, uploadId: start.uploadId, parts }),
    });
    const complete = await uploadResponse(completeResponse);
    if (!completeResponse.ok || !complete.entry) throw new Error(complete.error ?? "Не удалось завершить загрузку видео.");
    entries = entries.map((item) => item.id === id ? withVideoUrl(complete.entry) : item);
    setStatus("Видео прикреплено");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Не удалось прикрепить видео. Попробуйте ещё раз.");
  } finally {
    uploadingId = null;
    renderEntries();
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
    entries.unshift(withVideoUrl(entry));
    area.value = "";
    setStatus("Запись добавлена");
    renderEntries();
  } catch { setStatus("Не удалось сохранить запись. Попробуйте ещё раз."); }
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
