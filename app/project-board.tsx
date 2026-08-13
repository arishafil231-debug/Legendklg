"use client";

import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const sections = [
  {
    id: "legends",
    title: "Легенды",
    description: "Городские предания, слухи и истории, которые передают из уст в уста.",
    prompt: "Например: говорят, что в старом доме на Воскресенской…",
  },
  {
    id: "history",
    title: "История",
    description: "События, места и люди, из которых складывается летопись города.",
    prompt: "Например: в этом здании до революции находилась…",
  },
  {
    id: "identity",
    title: "Идентичность",
    description: "Что делает Калугу Калугой: слова, привычки, места и характер.",
    prompt: "Например: для меня Калуга — это…",
  },
  {
    id: "made",
    title: "Сделано в Калуге",
    description: "Люди, мастерские, продукты и идеи, созданные здесь.",
    prompt: "Например: название проекта, мастерской или инициативы…",
  },
] as const;

const authors = ["Алёна", "Даниил", "Владимир", "Арина", "Михаил", "Филипп"] as const;
const videoExtensions = /\.(mp4|m4v|mov|webm|avi)$/i;

type SectionId = (typeof sections)[number]["id"];
type Entry = {
  id: number;
  section: SectionId;
  content: string;
  author: string;
  hasVideo: boolean;
  videoUrl?: string;
  createdAt: string;
};

type UploadStart = { key?: string; uploadId?: string; error?: string };
type UploadPart = { partNumber?: number; etag?: string; error?: string };
type UploadComplete = { entry?: Entry; error?: string };

async function uploadResponse<T extends { error?: string }>(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: response.status === 413 ? "Сервер отклонил слишком большой фрагмент видео." : "Сервер не смог обработать загрузку видео." } as T;
  }
}

export function ProjectBoard() {
  const [inside, setInside] = useState(false);
  const [dissolving, setDissolving] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [active, setActive] = useState<SectionId>("legends");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [author, setAuthor] = useState<(typeof authors)[number]>(authors[0]);
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<Entry | null>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null);
  const resumeAmbientAfterVideoRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Загружаем городскую память…");

  const current = sections.find((section) => section.id === active)!;
  const visibleEntries = useMemo(
    () => entries
      .filter((entry) => entry.section === active)
      .sort((a, b) => a.content.localeCompare(b.content, "ru", { sensitivity: "base" })),
    [entries, active],
  );
  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase("ru");
    if (!term) return [];
    return entries
      .filter((entry) => {
        const section = sections.find((item) => item.id === entry.section);
        return [entry.content, entry.author, section?.title ?? ""]
          .some((value) => value.toLocaleLowerCase("ru").includes(term));
      })
      .sort((a, b) => a.content.localeCompare(b.content, "ru", { sensitivity: "base" }));
  }, [entries, searchTerm]);

  useEffect(() => {
    fetch("/api/entries")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: { entries: Entry[] }) => {
        setEntries(data.entries);
        setStatus("");
      })
      .catch(() => setStatus("Не удалось загрузить записи. Обновите страницу."));
  }, []);

  useLayoutEffect(() => {
    const video = fullscreenVideoRef.current;
    if (!selectedVideo || !video) return;
    video.muted = false;
    video.volume = 1;
    void video.play().catch(() => undefined);
  }, [selectedVideo]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeVideo();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.55;
    audio.play()
      .then(() => setSoundOn(true))
      .catch(() => setSoundOn(false));
  }, []);

  async function startAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setSoundOn(true);
    } catch {
      setSoundOn(false);
    }
  }

  function toggleSound() {
    const audio = audioRef.current;
    if (!audio) return;
    if (soundOn) {
      audio.pause();
      setSoundOn(false);
    } else {
      void startAudio();
    }
  }

  async function addEntry(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    setStatus("Сохраняем…");
    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: active, content, author }),
      });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { entry: Entry };
      setEntries((items) => [data.entry, ...items]);
      setDraft("");
      setStatus("Запись добавлена");
    } catch {
      setStatus("Не удалось сохранить. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: number) {
    const content = editText.trim();
    if (!content) return;
    setBusy(true);
    try {
      const response = await fetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, content }),
      });
      if (!response.ok) throw new Error();
      setEntries((items) =>
        items.map((item) => (item.id === id ? { ...item, content } : item)),
      );
      setEditing(null);
      setStatus("Изменения сохранены");
    } catch {
      setStatus("Не удалось сохранить изменения.");
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id: number) {
    if (!window.confirm("Удалить эту запись?")) return;
    const response = await fetch(`/api/entries?id=${id}`, { method: "DELETE" });
    if (response.ok) {
      setEntries((items) => items.filter((item) => item.id !== id));
      setStatus("Запись удалена");
    } else {
      setStatus("Не удалось удалить запись.");
    }
  }

  async function uploadVideo(id: number, file: File) {
    if (!(file.type.startsWith("video/") || videoExtensions.test(file.name))) {
      setStatus("Поддерживаются видео MP4, MOV, WebM, M4V и AVI.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setStatus("Размер видео не должен превышать 100 МБ.");
      return;
    }
    setUploadingId(id);
    setStatus("Загружаем видео…");
    try {
      const startResponse = await fetch("/api/videos?upload=start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: id, name: file.name, type: file.type, size: file.size }),
      });
      const start = await uploadResponse<UploadStart>(startResponse);
      if (!startResponse.ok || !start.key || !start.uploadId) throw new Error(start.error ?? "Не удалось начать загрузку видео.");

      const chunkSize = 6 * 1024 * 1024;
      const parts: { partNumber: number; etag: string }[] = [];
      for (let offset = 0, partNumber = 1; offset < file.size; offset += chunkSize, partNumber += 1) {
        const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
        const response = await fetch(`/api/videos?upload=part&key=${encodeURIComponent(start.key)}&uploadId=${encodeURIComponent(start.uploadId)}&partNumber=${partNumber}`, {
          method: "POST",
          body: chunk,
        });
        const part = await uploadResponse<UploadPart>(response);
        if (!response.ok || !part.etag || !part.partNumber) throw new Error(part.error ?? "Не удалось загрузить фрагмент видео.");
        parts.push({ partNumber: part.partNumber, etag: part.etag });
        setStatus(`Загружаем видео… ${Math.round(Math.min(offset + chunkSize, file.size) / file.size * 100)}%`);
      }

      const completeResponse = await fetch("/api/videos?upload=complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: id, key: start.key, uploadId: start.uploadId, parts }),
      });
      const complete = await uploadResponse<UploadComplete>(completeResponse);
      if (!completeResponse.ok || !complete.entry) throw new Error(complete.error ?? "Не удалось завершить загрузку видео.");
      setEntries((items) => items.map((item) => item.id === id ? complete.entry! : item));
      setStatus("Видео прикреплено");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось прикрепить видео. Попробуйте ещё раз.");
    } finally {
      setUploadingId(null);
    }
  }

  function openProject() {
    if (dissolving) return;
    if (!soundOn) void startAudio();
    setDissolving(true);
    window.setTimeout(() => {
      setInside(true);
      setDissolving(false);
    }, 560);
  }

  function chooseSearchResult(entry: Entry) {
    setActive(entry.section);
    setEditing(null);
    setSearchTerm("");
    setSearchOpen(false);
    window.setTimeout(() => document.querySelector(".entries")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function closeVideo() {
    fullscreenVideoRef.current?.pause();
    setSelectedVideo(null);
    if (resumeAmbientAfterVideoRef.current) {
      resumeAmbientAfterVideoRef.current = false;
      void startAudio();
    }
  }

  function openVideo(entry: Entry) {
    const audio = audioRef.current;
    resumeAmbientAfterVideoRef.current = Boolean(audio && !audio.paused);
    if (resumeAmbientAfterVideoRef.current) {
      audio?.pause();
      setSoundOn(false);
    }
    setSelectedVideo(entry);
  }

  if (!inside) {
    return (
      <>
        <audio ref={audioRef} src="/ambient.mp3" autoPlay loop preload="auto" />
        <button
          className={`sound-toggle${soundOn ? " is-on" : " is-off"}`}
          onClick={toggleSound}
          aria-label={soundOn ? "Выключить звук" : "Включить звук"}
          aria-pressed={soundOn}
        >
          <span className="sound-glyph" aria-hidden="true">♪</span>
        </button>
        <main className={`landing cover-landing${dissolving ? " is-dissolving" : ""}`}>
          <div className="cover-shade" aria-hidden="true" />
          <button className="glass-project-card" onClick={openProject}>
            <strong>Легенды Калуги</strong>
            <span className="glass-project-arrow" aria-hidden="true">→</span>
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <audio ref={audioRef} src="/ambient.mp3" autoPlay loop preload="auto" />
      <button
        className={`sound-toggle${soundOn ? " is-on" : " is-off"}`}
        onClick={toggleSound}
        aria-label={soundOn ? "Выключить звук" : "Включить звук"}
        aria-pressed={soundOn}
      >
        <span className="sound-glyph" aria-hidden="true">♪</span>
      </button>
      <main className="workspace dissolve-in">
      <header className="workspace-head">
        <button className="back" onClick={() => setInside(false)}>← Все проекты</button>
        <div className="mini-brand"><span className="brand-mark">К</span> Проекты Калуги</div>
        <div className="workspace-tools">
          <div className={`site-search${searchOpen ? " is-open" : ""}`}>
            <button
              className="search-toggle"
              onClick={() => setSearchOpen((open) => !open)}
              aria-label="Поиск по всем разделам"
              aria-expanded={searchOpen}
            >⌕</button>
            {searchOpen && (
              <div className="search-popover">
                <input
                  autoFocus
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Поиск по всем разделам"
                  aria-label="Ключевые слова для поиска"
                />
                {searchTerm.trim() && (
                  <div className="search-results" aria-live="polite">
                    {searchResults.length ? searchResults.map((entry) => {
                      const section = sections.find((item) => item.id === entry.section)!;
                      return (
                        <button key={entry.id} onClick={() => chooseSearchResult(entry)}>
                          <span>{entry.content}</span>
                          <small>{section.title}{entry.hasVideo ? " · видео" : ""}</small>
                        </button>
                      );
                    }) : <p>Ничего не найдено</p>}
                  </div>
                )}
              </div>
            )}
          </div>
          <span className="access"><i /> открыто по ссылке</span>
        </div>
      </header>

      <section className="project-intro">
        <h1>Легенды Калуги</h1>
        <p>Общая тетрадь городской памяти. Выберите раздел и добавьте то, что знаете.</p>
      </section>

      <nav className="section-tabs" aria-label="Разделы проекта">
        {sections.map((section) => (
          <button
            key={section.id}
            className={active === section.id ? "active" : ""}
            onClick={() => {
              setActive(section.id);
              setEditing(null);
            }}
          >
            {section.title}
          </button>
        ))}
      </nav>

      <section className="entry-panel">
        <div className="entry-heading">
          <div><h2>{current.title}</h2></div>
          <p>{current.description}</p>
        </div>

        <form className="entry-form" onSubmit={addEntry}>
          <label htmlFor="new-entry">Название записи</label>
          <div className="entry-control">
            <textarea
              id="new-entry"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={current.prompt}
              maxLength={500}
              rows={2}
            />
            <button className="confirm-entry" disabled={!draft.trim() || busy} aria-label="Добавить запись">✓</button>
          </div>
          <div className="author-control">
            <label htmlFor="entry-author">Кто сделал этот проект</label>
            <select id="entry-author" value={author} onChange={(event) => setAuthor(event.target.value as (typeof authors)[number])}>
              {authors.map((person) => <option key={person} value={person}>{person}</option>)}
            </select>
          </div>
          <div className="form-note">
            <span>До 500 знаков</span>
            <span>Запись увидят все посетители</span>
          </div>
        </form>

        <div className="entries-head">
          <h3>Собрано вместе</h3>
          <span>{visibleEntries.length} {visibleEntries.length === 1 ? "запись" : "записей"}</span>
        </div>

        <div className="entries" aria-live="polite">
          {visibleEntries.length === 0 && !status && (
            <div className="empty">
              <span>✦</span>
              <p>Здесь пока тихо.</p>
              <small>Оставьте первую запись в этом разделе.</small>
            </div>
          )}
          {visibleEntries.map((entry) => (
            <article className="entry project-entry" key={entry.id}>
              {editing === entry.id ? (
                <div className="edit-row">
                  <textarea value={editText} onChange={(event) => setEditText(event.target.value)} maxLength={500} />
                  <button onClick={() => saveEdit(entry.id)} disabled={busy}>Сохранить</button>
                  <button className="quiet" onClick={() => setEditing(null)}>Отмена</button>
                </div>
              ) : (
                <>
                  <h3>{entry.content}</h3>
                  <div className="entry-foot">
                    <span className="entry-meta"><span className="made-by">Сделал(а)</span>{entry.author && <span className="author-chip">{entry.author}</span>}</span>
                  </div>
                  <div className="video-area">
                    {entry.hasVideo && entry.videoUrl ? (
                      <video
                        muted
                        playsInline
                        preload="metadata"
                        src={entry.videoUrl}
                        onMouseEnter={(event) => { void event.currentTarget.play().catch(() => undefined); }}
                        onMouseLeave={(event) => {
                          event.currentTarget.pause();
                          event.currentTarget.currentTime = 0;
                        }}
                        onClick={() => openVideo(entry)}
                      >Ваш браузер не поддерживает видео.</video>
                    ) : (
                      <p>Видеофайлов пока нет</p>
                    )}
                  </div>
                  <div className="entry-actions">
                    <label className={`video-upload${uploadingId === entry.id ? " is-uploading" : ""}`}>
                      <input
                        type="file"
                        accept="video/*"
                        disabled={uploadingId !== null}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) void uploadVideo(entry.id, file);
                          event.currentTarget.value = "";
                        }}
                      />
                      {uploadingId === entry.id ? "Загрузка…" : entry.hasVideo ? "Заменить видео" : "Прикрепить видео"}
                    </label>
                    <span>
                      <button onClick={() => { setEditing(entry.id); setEditText(entry.content); }}>Изменить</button>
                      <button onClick={() => removeEntry(entry.id)}>Удалить</button>
                    </span>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
        {status && <p className="status" role="status">{status}</p>}
      </section>
      </main>
      {selectedVideo?.videoUrl && (
        <div className="video-modal" role="dialog" aria-modal="true" aria-label={`Видео: ${selectedVideo.content}`} onClick={closeVideo}>
          <div className="video-modal-frame" onClick={(event) => event.stopPropagation()}>
            <button className="video-modal-close" onClick={closeVideo} aria-label="Закрыть видео">×</button>
            <video ref={fullscreenVideoRef} src={selectedVideo.videoUrl} controls playsInline>
              Ваш браузер не поддерживает видео.
            </video>
            <p>{selectedVideo.content}</p>
          </div>
        </div>
      )}
    </>
  );
}
