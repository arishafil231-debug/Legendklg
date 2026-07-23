"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const sections = [
  {
    id: "legends",
    title: "Легенды",
    number: "01",
    description: "Городские предания, слухи и истории, которые передают из уст в уста.",
    prompt: "Например: говорят, что в старом доме на Воскресенской…",
  },
  {
    id: "history",
    title: "История",
    number: "02",
    description: "События, места и люди, из которых складывается летопись города.",
    prompt: "Например: в этом здании до революции находилась…",
  },
  {
    id: "identity",
    title: "Идентичность",
    number: "03",
    description: "Что делает Калугу Калугой: слова, привычки, места и характер.",
    prompt: "Например: для меня Калуга — это…",
  },
  {
    id: "made",
    title: "Сделано в Калуге",
    number: "04",
    description: "Люди, мастерские, продукты и идеи, созданные здесь.",
    prompt: "Например: название проекта, мастерской или инициативы…",
  },
] as const;

type SectionId = (typeof sections)[number]["id"];
type Entry = {
  id: number;
  section: SectionId;
  content: string;
  createdAt: string;
};

export function ProjectBoard() {
  const [inside, setInside] = useState(false);
  const [active, setActive] = useState<SectionId>("legends");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Загружаем городскую память…");

  const current = sections.find((section) => section.id === active)!;
  const visibleEntries = useMemo(
    () => entries.filter((entry) => entry.section === active),
    [entries, active],
  );

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
        body: JSON.stringify({ section: active, content }),
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

  if (!inside) {
    return (
      <main className="landing">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <header className="masthead">
          <a className="brand" href="#" aria-label="Проекты Калуги">
            <span className="brand-mark">К</span>
            <span>Проекты Калуги</span>
          </a>
          <span className="access"><i /> открыто по ссылке</span>
        </header>

        <section className="hero">
          <p className="eyebrow">Коллекция городских проектов</p>
          <h1>Место, где город<br /><em>рассказывает о себе</em></h1>
          <p className="hero-copy">
            Собираем память, истории и идеи Калуги вместе.
            Каждый, у кого есть ссылка, может внести свой след.
          </p>
        </section>

        <section className="projects" aria-labelledby="projects-title">
          <div className="section-heading">
            <h2 id="projects-title">Все проекты</h2>
            <span>1 проект</span>
          </div>
          <button className="project-card" onClick={() => setInside(true)}>
            <span className="project-index">Проект 01</span>
            <span className="moon">✦</span>
            <span className="project-copy">
              <strong>Легенды<br />Калуги</strong>
              <small>Городская память, собранная вместе</small>
            </span>
            <span className="project-meta">
              <span>4 раздела</span>
              <b aria-hidden="true">↗</b>
            </span>
          </button>
        </section>
        <footer>Калуга · 2026 <span>Храним то, что легко потерять</span></footer>
      </main>
    );
  }

  return (
    <main className="workspace">
      <header className="workspace-head">
        <button className="back" onClick={() => setInside(false)}>← Все проекты</button>
        <div className="mini-brand"><span className="brand-mark">К</span> Проекты Калуги</div>
        <span className="access"><i /> открыто по ссылке</span>
      </header>

      <section className="project-intro">
        <p className="eyebrow">Проект 01</p>
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
            <span>{section.number}</span>{section.title}
          </button>
        ))}
      </nav>

      <section className="entry-panel">
        <div className="entry-heading">
          <div>
            <span className="section-number">{current.number}</span>
            <h2>{current.title}</h2>
          </div>
          <p>{current.description}</p>
        </div>

        <form className="entry-form" onSubmit={addEntry}>
          <label htmlFor="new-entry">Добавить запись</label>
          <div className="entry-control">
            <textarea
              id="new-entry"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={current.prompt}
              maxLength={500}
              rows={2}
            />
            <button disabled={!draft.trim() || busy} aria-label="Добавить запись">→</button>
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
            <article className="entry" key={entry.id}>
              {editing === entry.id ? (
                <div className="edit-row">
                  <textarea value={editText} onChange={(event) => setEditText(event.target.value)} maxLength={500} />
                  <button onClick={() => saveEdit(entry.id)} disabled={busy}>Сохранить</button>
                  <button className="quiet" onClick={() => setEditing(null)}>Отмена</button>
                </div>
              ) : (
                <>
                  <p>{entry.content}</p>
                  <div className="entry-foot">
                    <time>{new Date(entry.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</time>
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
  );
}
