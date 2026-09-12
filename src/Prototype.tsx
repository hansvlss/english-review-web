import {
  ArchiveIcon,
  ArrowLeftIcon,
  BookmarkIcon,
  CheckCircledIcon,
  ChevronRightIcon,
  Cross2Icon,
  HomeIcon,
  MagnifyingGlassIcon,
  Pencil1Icon,
  PersonIcon,
  PlusIcon,
  SpeakerLoudIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { KeyboardInput, KeyboardTextarea, MobileScroll, useKeyboard } from "./mobile";
import {
  REVIEW_INTERVAL_DAYS,
  formatNextDue,
  isDue,
  scheduleReview,
  toLocalDateKey,
  type ReviewRating,
  type ReviewState,
} from "./review";

type EntryType = "word" | "phrase" | "sentence";

type Book = { id: string; ownerId: string; name: string; createdAt: string };
type Entry = {
  id: string;
  ownerId: string;
  bookId: string;
  type: EntryType;
  english: string;
  meaning: string;
  ipa: string;
  exampleEn: string;
  exampleZh: string;
  updatedAt: string;
  review: ReviewState;
};
type ReviewLog = {
  id: string;
  ownerId: string;
  entryId: string;
  rating: ReviewRating;
  reviewedAt: string;
  beforeStage: number;
  afterStage: number;
};
type DailyCheckIn = { id: string; ownerId: string; date: string; completedAt: string; reviewCount: number };
type User = { id: string; phone: string };
type AppData = { user: User | null; books: Book[]; entries: Entry[]; logs: ReviewLog[]; checkIns: DailyCheckIn[] };
type Navigate = (path: string) => void;

const STORAGE_KEY = "english-review-web:v1";
const DRAFT_KEY = "english-review-web:entry-draft";
const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const TTS_ENDPOINT = import.meta.env.VITE_TTS_ENDPOINT ?? "";
const IPA_ENDPOINT = import.meta.env.VITE_IPA_ENDPOINT ?? "";
const LOCAL_USER_ID = "local-test-user";
const DAY_MS = 86_400_000;
const TYPE_LABELS: Record<EntryType, string> = { word: "单词", phrase: "词组", sentence: "句子" };
const ROUTE_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const LOCAL_IPA: Record<string, string> = {
  resilient: "/rɪˈzɪliənt/",
  "follow through": "/ˌfɑːloʊ ˈθruː/",
  clarify: "/ˈklerəfaɪ/",
  "trade-off": "/ˈtreɪd ɔːf/",
};

function currentRoute() {
  const pathname = ROUTE_BASE && location.pathname.startsWith(ROUTE_BASE)
    ? location.pathname.slice(ROUTE_BASE.length) || "/"
    : location.pathname;
  return (pathname === "/" ? "/today" : pathname) + location.search;
}

function browserPath(route: string) {
  return `${ROUTE_BASE}${route}`;
}

function makeId(prefix: string) {
  const value = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}

function initialData(): AppData {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as AppData;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  const now = Date.now();
  const due = new Date(now - 60_000).toISOString();
  return {
    user: null,
    books: [
      { id: "book-work", ownerId: LOCAL_USER_ID, name: "职场表达", createdAt: new Date(now - 20 * DAY_MS).toISOString() },
      { id: "book-reading", ownerId: LOCAL_USER_ID, name: "阅读摘录", createdAt: new Date(now - 8 * DAY_MS).toISOString() },
    ],
    entries: [
      {
        id: "entry-follow-through", ownerId: LOCAL_USER_ID, bookId: "book-work", type: "phrase",
        english: "follow through", meaning: "坚持到底；把事情做完", ipa: "/ˌfɑːloʊ ˈθruː/",
        exampleEn: "Good ideas only matter when you follow through.", exampleZh: "好点子只有在你坚持执行时才有意义。",
        updatedAt: new Date(now - DAY_MS).toISOString(), review: { stage: 1, dueAt: due },
      },
      {
        id: "entry-resilient", ownerId: LOCAL_USER_ID, bookId: "book-work", type: "word",
        english: "resilient", meaning: "有韧性的；能迅速恢复的", ipa: "/rɪˈzɪliənt/",
        exampleEn: "A resilient team learns from setbacks.", exampleZh: "有韧性的团队会从挫折中学习。",
        updatedAt: new Date(now - 2 * DAY_MS).toISOString(), review: { stage: 0, dueAt: due },
      },
      {
        id: "entry-clarify", ownerId: LOCAL_USER_ID, bookId: "book-work", type: "word",
        english: "clarify", meaning: "澄清；使清楚", ipa: "/ˈklerəfaɪ/",
        exampleEn: "Could you clarify the final requirement?", exampleZh: "你能澄清一下最终需求吗？",
        updatedAt: new Date(now - 3 * DAY_MS).toISOString(), review: { stage: 2, dueAt: due },
      },
      {
        id: "entry-trade-off", ownerId: LOCAL_USER_ID, bookId: "book-reading", type: "phrase",
        english: "trade-off", meaning: "权衡；折中", ipa: "/ˈtreɪd ɔːf/",
        exampleEn: "Every design choice involves a trade-off.", exampleZh: "每个设计选择都包含取舍。",
        updatedAt: new Date(now - 4 * DAY_MS).toISOString(), review: { stage: 3, dueAt: new Date(now + 4 * DAY_MS).toISOString() },
      },
    ],
    logs: [],
    checkIns: [],
  };
}

function maskPhone(phone: string) {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function Header({ title, onBack, action }: { title: string; onBack?: () => void; action?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-side">{onBack ? <button className="icon-button" type="button" onClick={onBack} aria-label="返回"><ArrowLeftIcon /></button> : null}</div>
      <h1>{title}</h1>
      <div className="topbar-side topbar-action">{action}</div>
    </header>
  );
}

function BottomNav({ path, navigate }: { path: string; navigate: Navigate }) {
  const items = [
    { path: "/today", label: "今日", icon: <HomeIcon /> },
    { path: "/books", label: "词书", icon: <ArchiveIcon /> },
    { path: "/account", label: "我的", icon: <PersonIcon /> },
  ];
  return (
    <nav className="bottom-nav" aria-label="主要导航">
      {items.map((item) => (
        <button className={path.startsWith(item.path) ? "active" : ""} type="button" key={item.path} onClick={() => navigate(item.path)}>
          {item.icon}<span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function LoginScreen({ onLogin, toast }: { onLogin: (user: User) => void; toast: (message: string) => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    if (!/^1\d{10}$/.test(phone)) return toast("请输入正确的 11 位手机号");
    setBusy(true);
    try {
      if (API_BASE) {
        const response = await fetch(`${API_BASE}/auth/request-code`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }),
        });
        if (!response.ok) throw new Error("验证码发送失败");
        toast("验证码已发送");
      } else {
        toast("本地测试验证码：123456");
      }
      setSent(true);
    } catch (error) {
      toast(error instanceof Error ? error.message : "验证码发送失败");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!sent) return void await requestCode();
    setBusy(true);
    try {
      if (API_BASE) {
        const response = await fetch(`${API_BASE}/auth/verify`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code }),
        });
        if (!response.ok) throw new Error("验证码不正确或已失效");
        const result = (await response.json()) as { userId: string };
        onLogin({ id: result.userId, phone });
      } else {
        if (code !== "123456") throw new Error("本地测试验证码为 123456");
        onLogin({ id: LOCAL_USER_ID, phone });
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="brand-mark" aria-hidden="true"><BookmarkIcon /></div>
      <p className="eyebrow">YOUR OWN ENGLISH</p>
      <h1>把遇见的英语，<br />变成自己的词书。</h1>
      <p className="login-copy">快速收录真实语境，按节奏复习。首版使用手机号登录。</p>
      <form className="login-form" onSubmit={submit}>
        <label>手机号
          <KeyboardInput value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))} inputMode="numeric" placeholder="请输入手机号" autoComplete="tel" />
        </label>
        {sent ? <label>验证码
          <div className="code-row">
            <KeyboardInput value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6 位验证码" autoComplete="one-time-code" />
            <button type="button" className="text-button" onClick={requestCode}>重发</button>
          </div>
        </label> : null}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "请稍候…" : sent ? "登录" : "获取验证码"}</button>
      </form>
      <p className="mode-note">{API_BASE ? "云端账号模式" : "本地测试模式 · 验证码 123456"}</p>
    </main>
  );
}

function TodayScreen({ data, navigate }: { data: AppData; navigate: Navigate }) {
  const dueEntries = data.entries.filter((entry) => isDue(entry.review.dueAt));
  const recentDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
  return (
    <>
      <div className="page-body today-page">
        <header className="home-header">
          <div>
            <p className="eyebrow">{new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date())}</p>
            <h1>今天，继续一点点。</h1>
          </div>
          <button className="avatar-button" type="button" onClick={() => navigate("/account")} aria-label="进入我的账户">{data.user?.phone.slice(-2)}</button>
        </header>
        <section className="review-hero" aria-labelledby="review-heading">
          <div><p className="section-kicker">今日复习</p><h2 id="review-heading"><strong>{dueEntries.length}</strong> 个待复习</h2><p>{dueEntries.length ? "大约 2 分钟完成" : "今天的内容已经处理完了"}</p></div>
          <button className="round-arrow" type="button" disabled={!dueEntries.length} onClick={() => navigate("/review")} aria-label="开始复习"><ChevronRightIcon /></button>
        </section>
        <button className="quick-add" type="button" onClick={() => navigate("/entries/new") }>
          <span className="quick-add-icon"><PlusIcon /></span><span><strong>快速添加</strong><small>记录刚遇到的单词、词组或句子</small></span><ChevronRightIcon />
        </button>
        <section className="section-block">
          <div className="section-title-row"><h2>近七日打卡</h2><span>{data.checkIns.filter((checkIn) => recentDates.some((date) => checkIn.date === toLocalDateKey(date))).length} 天</span></div>
          <div className="checkin-strip">
            {recentDates.map((date) => {
              const key = toLocalDateKey(date);
              const checked = data.checkIns.some((checkIn) => checkIn.date === key);
              return <div key={key} className={checked ? "checked" : ""}><span>{["日", "一", "二", "三", "四", "五", "六"][date.getDay()]}</span><b>{date.getDate()}</b><i>{checked ? <CheckCircledIcon /> : null}</i></div>;
            })}
          </div>
        </section>
        <section className="section-block">
          <div className="section-title-row"><h2>我的词书</h2><button type="button" onClick={() => navigate("/books")}>全部</button></div>
          <div className="book-preview-list">
            {data.books.slice(0, 2).map((book) => {
              const count = data.entries.filter((entry) => entry.bookId === book.id).length;
              return <button key={book.id} type="button" onClick={() => navigate(`/books/${book.id}`)}><span className="book-icon"><BookmarkIcon /></span><span><strong>{book.name}</strong><small>{count} 条内容</small></span><ChevronRightIcon /></button>;
            })}
          </div>
        </section>
      </div>
      <BottomNav path="/today" navigate={navigate} />
    </>
  );
}

function BooksScreen({ data, setData, navigate, toast }: { data: AppData; setData: (updater: (current: AppData) => AppData) => void; navigate: Navigate; toast: (message: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  function addBook(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (data.books.some((book) => book.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) return toast("已经有同名词书");
    setData((current) => ({ ...current, books: [...current.books, { id: makeId("book"), ownerId: current.user!.id, name: trimmed, createdAt: new Date().toISOString() }] }));
    setName(""); setAdding(false); toast("词书已创建");
  }
  return (
    <>
      <div className="page-body">
        <Header title="我的词书" action={<button className="icon-button" type="button" onClick={() => setAdding(!adding)} aria-label="新建词书"><PlusIcon /></button>} />
        {adding ? <form className="inline-form" onSubmit={addBook}><KeyboardInput value={name} onChange={(event) => setName(event.target.value)} placeholder="词书名称" autoFocus /><button className="small-primary" type="submit">创建</button></form> : null}
        <div className="book-grid">
          {data.books.map((book, index) => {
            const entries = data.entries.filter((entry) => entry.bookId === book.id);
            const due = entries.filter((entry) => isDue(entry.review.dueAt)).length;
            return <button key={book.id} type="button" onClick={() => navigate(`/books/${book.id}`)}><span className={`book-cover cover-${index % 3}`}><BookmarkIcon /></span><span className="book-card-copy"><strong>{book.name}</strong><small>{entries.length} 条 · {due} 条待复习</small></span><ChevronRightIcon /></button>;
          })}
        </div>
        <p className="quiet-tip">同一词书内会忽略大小写检查重复内容。</p>
      </div>
      <BottomNav path="/books" navigate={navigate} />
    </>
  );
}

function BookDetailScreen({ book, entries, navigate, onDelete }: { book: Book; entries: Entry[]; navigate: Navigate; onDelete: (entry: Entry) => void }) {
  const [query, setQuery] = useState("");
  const filtered = entries.filter((entry) => `${entry.english} ${entry.meaning}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="page-body">
    <Header title={book.name} onBack={() => navigate("/books")} action={<button className="icon-button" type="button" onClick={() => navigate(`/entries/new?book=${book.id}`)} aria-label="添加内容"><PlusIcon /></button>} />
    <label className="search-field"><MagnifyingGlassIcon /><KeyboardInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索英文或中文" aria-label="搜索英文或中文" /></label>
    <p className="list-count">共 {entries.length} 条</p>
    <div className="entry-list">
      {filtered.map((entry) => <article key={entry.id}>
        <button className="entry-main" type="button" onClick={() => navigate(`/entries/${entry.id}/edit`)}><span><strong>{entry.english}</strong><small>{entry.ipa || TYPE_LABELS[entry.type]}</small><em>{entry.meaning}</em></span><ChevronRightIcon /></button>
        <div className="entry-actions"><button type="button" onClick={() => navigate(`/entries/${entry.id}/edit`)} aria-label={`编辑 ${entry.english}`}><Pencil1Icon /></button><button type="button" onClick={() => onDelete(entry)} aria-label={`删除 ${entry.english}`}><TrashIcon /></button></div>
      </article>)}
      {!filtered.length ? <div className="empty-state"><MagnifyingGlassIcon /><strong>没有找到内容</strong><p>换一个关键词试试。</p></div> : null}
    </div>
  </div>;
}

type EntryDraft = Pick<Entry, "type" | "english" | "meaning" | "ipa" | "exampleEn" | "exampleZh" | "bookId">;

function EntryForm({ data, entry, initialBookId, navigate, saveEntry, toast }: { data: AppData; entry?: Entry; initialBookId?: string; navigate: Navigate; saveEntry: (draft: EntryDraft, original?: Entry) => void; toast: (message: string) => void }) {
  let parsedDraft: Partial<EntryDraft> = {};
  if (!entry) {
    try { parsedDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}"); } catch { localStorage.removeItem(DRAFT_KEY); }
  }
  const [draft, setDraft] = useState<EntryDraft>({
    type: entry?.type ?? parsedDraft.type ?? "word", english: entry?.english ?? parsedDraft.english ?? "", meaning: entry?.meaning ?? parsedDraft.meaning ?? "",
    ipa: entry?.ipa ?? parsedDraft.ipa ?? "", exampleEn: entry?.exampleEn ?? parsedDraft.exampleEn ?? "", exampleZh: entry?.exampleZh ?? parsedDraft.exampleZh ?? "",
    bookId: entry?.bookId ?? initialBookId ?? parsedDraft.bookId ?? data.books[0]?.id ?? "",
  });
  const [lookingUp, setLookingUp] = useState(false);
  useEffect(() => { if (!entry) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); }, [draft, entry]);
  function update<K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function lookupIpa() {
    const text = draft.english.trim().toLocaleLowerCase();
    if (!text || draft.type === "sentence") return;
    setLookingUp(true);
    try {
      if (IPA_ENDPOINT) {
        const response = await fetch(IPA_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
        if (!response.ok) throw new Error("音标查询失败");
        const result = (await response.json()) as { ipa?: string };
        if (!result.ipa) throw new Error("未找到音标，可以手动填写");
        update("ipa", result.ipa);
      } else if (LOCAL_IPA[text]) update("ipa", LOCAL_IPA[text]);
      else toast("本地词典未命中，可以手动填写音标");
    } catch (error) { toast(error instanceof Error ? error.message : "音标查询失败"); }
    finally { setLookingUp(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.english.trim() || !draft.meaning.trim() || !draft.bookId) return toast("请填写英文、中文意思并选择词书");
    const duplicate = data.entries.find((candidate) => candidate.bookId === draft.bookId && candidate.id !== entry?.id && candidate.english.trim().toLocaleLowerCase() === draft.english.trim().toLocaleLowerCase());
    if (duplicate) { toast("这条内容已存在，已为你打开原条目"); navigate(`/entries/${duplicate.id}/edit`); return; }
    saveEntry({ ...draft, english: draft.english.trim(), meaning: draft.meaning.trim() }, entry);
    localStorage.removeItem(DRAFT_KEY);
  }
  return <div className="page-body form-page">
    <Header title={entry ? "编辑内容" : "添加内容"} onBack={() => navigate(entry ? `/books/${entry.bookId}` : "/today")} />
    <form onSubmit={submit}>
      <fieldset className="type-switch"><legend>内容类型</legend><div>{(["word", "phrase", "sentence"] as EntryType[]).map((type) => <button type="button" className={draft.type === type ? "selected" : ""} onClick={() => update("type", type)} key={type}>{TYPE_LABELS[type]}</button>)}</div></fieldset>
      <label className="form-field">英文内容 <KeyboardTextarea value={draft.english} onChange={(event) => update("english", event.target.value)} placeholder="输入单词、词组或句子" rows={draft.type === "sentence" ? 3 : 2} onBlur={() => void lookupIpa()} /></label>
      <label className="form-field">中文意思 <KeyboardTextarea value={draft.meaning} onChange={(event) => update("meaning", event.target.value)} placeholder="写下你真正理解的意思" rows={3} /></label>
      <label className="form-field">所属词书 <select value={draft.bookId} onChange={(event) => update("bookId", event.target.value)}>{data.books.map((book) => <option value={book.id} key={book.id}>{book.name}</option>)}</select></label>
      {draft.type !== "sentence" ? <label className="form-field">美式音标 <div className="field-with-action"><KeyboardInput value={draft.ipa} onChange={(event) => update("ipa", event.target.value)} placeholder="可自动补全或手动填写" /><button type="button" onClick={() => void lookupIpa()} disabled={lookingUp}>{lookingUp ? "查询中" : "查询"}</button></div></label> : <p className="field-note">整句只提供朗读，不自动生成不可靠的整句音标。</p>}
      <label className="form-field">英文例句（可选） <KeyboardTextarea value={draft.exampleEn} onChange={(event) => update("exampleEn", event.target.value)} placeholder="保留遇见它时的上下文" rows={3} /></label>
      <label className="form-field">例句中文（可选） <KeyboardTextarea value={draft.exampleZh} onChange={(event) => update("exampleZh", event.target.value)} placeholder="例句的中文理解" rows={3} /></label>
      <button className="primary-button form-submit" type="submit">{entry ? "保存修改" : "加入词书"}</button>
    </form>
  </div>;
}

function highlightedContext(entry: Entry) {
  const sentence = entry.type === "sentence" ? entry.english : entry.exampleEn || entry.english;
  if (sentence === entry.english || entry.type === "sentence") return sentence;
  const start = sentence.toLocaleLowerCase().indexOf(entry.english.toLocaleLowerCase());
  if (start < 0) return sentence;
  return <>{sentence.slice(0, start)}<mark>{sentence.slice(start, start + entry.english.length)}</mark>{sentence.slice(start + entry.english.length)}</>;
}

function ReviewScreen({ entries, sessionIndex, revealed, completedCount, submitting, error, navigate, setRevealed, speak, submitRating }: { entries: Entry[]; sessionIndex: number; revealed: boolean; completedCount: number; submitting: boolean; error: string; navigate: Navigate; setRevealed: (value: boolean) => void; speak: (text: string) => void; submitRating: (rating: ReviewRating) => void }) {
  if (sessionIndex >= entries.length) {
    const next = entries.map((entry) => entry.review.dueAt).sort()[0];
    return <main className="completion-screen"><div className="completion-icon"><CheckCircledIcon /></div><p className="eyebrow">今日已打卡</p><h1>复习完成</h1><p>本次完成 <strong>{completedCount}</strong> 条内容。</p><div className="completion-summary"><span>下一次待复习</span><strong>{next ? formatNextDue(next) : "暂无"}</strong></div><button className="primary-button" type="button" onClick={() => navigate("/today")}>回到今日</button></main>;
  }
  const entry = entries[sessionIndex];
  return <main className="review-screen">
    <header className="review-topbar"><button className="icon-button" type="button" onClick={() => navigate("/today")} aria-label="退出复习"><Cross2Icon /></button><strong>{entry.bookId === "book-work" ? "职场表达" : "我的词书"}</strong><span>{sessionIndex + 1}/{entries.length}</span></header>
    <div className="progress-track"><i style={{ width: `${((sessionIndex + 1) / entries.length) * 100}%` }} /></div>
    <section className="review-content"><p className="review-prompt">先回想这句话</p><h1>{highlightedContext(entry)}</h1><button className="speak-link" type="button" onClick={() => speak(entry.type === "sentence" ? entry.english : entry.exampleEn || entry.english)}><span className="speak-bubble"><SpeakerLoudIcon /></span>朗读整句</button>
      {!revealed ? <button className="reveal-button" type="button" onClick={() => { setRevealed(true); requestAnimationFrame(() => document.querySelector<HTMLElement>(".mobile-scroll")?.scrollTo({ top: 0 })); }}>显示答案</button> : <div className="answer-panel"><div className="answer-heading"><div><h2>{entry.english}</h2><span>{TYPE_LABELS[entry.type]}</span></div></div>{entry.ipa ? <div className="ipa-row"><p className="ipa">{entry.ipa}</p><button className="mini-speaker" type="button" onClick={() => speak(entry.english)} aria-label={`朗读 ${entry.english}`}><span><SpeakerLoudIcon /></span></button></div> : null}<p className="meaning">{entry.meaning}</p>{entry.exampleZh ? <div className="example-block"><span>例句翻译</span><p className="example-translation">{entry.exampleZh}</p></div> : null}</div>}
    </section>
    {revealed ? <footer className="review-actions">{error ? <p className="submit-error">{error}</p> : null}<div><button className="again-button" type="button" disabled={submitting} onClick={() => submitRating("again")}><strong>忘了</strong><span>· 1 分钟</span></button><button className="remember-button" type="button" disabled={submitting} onClick={() => submitRating("remembered")}><strong>{submitting ? "保存中…" : "记得"}</strong><span>· {REVIEW_INTERVAL_DAYS[entry.review.stage]} 天</span></button></div><p>选择后自动进入下一条</p></footer> : null}
  </main>;
}

function AccountScreen({ data, navigate, logout }: { data: AppData; navigate: Navigate; logout: () => void }) {
  return <><div className="page-body account-page"><Header title="我的" /><section className="profile-block"><div className="profile-avatar">{data.user?.phone.slice(-2)}</div><div><strong>{data.user ? maskPhone(data.user.phone) : "未登录"}</strong><span>{API_BASE ? "云端账号" : "本地测试账号"}</span></div></section><div className="stat-row"><div><strong>{data.entries.length}</strong><span>已收录</span></div><div><strong>{data.logs.length}</strong><span>已复习</span></div><div><strong>{data.checkIns.length}</strong><span>打卡天数</span></div></div><section className="settings-list"><div><span>数据模式</span><strong>{API_BASE ? "云端接口" : "本地存储"}</strong></div><div><span>朗读方式</span><strong>{TTS_ENDPOINT ? "微软神经语音 · 浏览器兜底" : "免费系统语音"}</strong></div><div><span>复习间隔</span><strong>1 · 3 · 7 · 14 · 30 天</strong></div></section><button className="secondary-button" type="button" onClick={logout}>退出登录</button></div><BottomNav path="/account" navigate={navigate} /></>;
}

export default function Prototype() {
  const keyboard = useKeyboard();
  const [data, setDataState] = useState<AppData>(initialData);
  const [path, setPath] = useState(currentRoute);
  const [toastMessage, setToastMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [reviewIds, setReviewIds] = useState<string[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [reviewCompleted, setReviewCompleted] = useState(0);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");

  function setData(updater: (current: AppData) => AppData) {
    setDataState((current) => { const next = updater(current); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return next; });
  }
  function toast(message: string) { setToastMessage(message); window.setTimeout(() => setToastMessage(""), 2600); }
  function navigate(nextPath: string) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    keyboard.hide(); history.pushState({}, "", browserPath(nextPath)); setPath(nextPath);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(".mobile-scroll")?.scrollTo({ top: 0 }));
    if (nextPath === "/review") {
      setReviewIds(data.entries.filter((entry) => isDue(entry.review.dueAt)).sort((a, b) => a.review.dueAt.localeCompare(b.review.dueAt)).map((entry) => entry.id));
      setReviewIndex(0); setReviewCompleted(0); setReviewRevealed(false); setReviewError("");
    }
  }
  useEffect(() => {
    if (currentRoute() === "/today" && !location.pathname.endsWith("/today")) history.replaceState({}, "", browserPath("/today"));
    const pop = () => setPath(currentRoute());
    window.addEventListener("popstate", pop); return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (path === "/review" && reviewIds.length === 0) {
      setReviewIds(data.entries.filter((entry) => isDue(entry.review.dueAt)).sort((a, b) => a.review.dueAt.localeCompare(b.review.dueAt)).map((entry) => entry.id));
    }
  }, [data.entries, path, reviewIds.length]);
  const activeReviewEntries = useMemo(() => reviewIds.map((id) => data.entries.find((entry) => entry.id === id)).filter(Boolean) as Entry[], [data.entries, reviewIds]);

  function saveEntry(draft: EntryDraft, original?: Entry) {
    const now = new Date().toISOString();
    setData((current) => ({ ...current, entries: original ? current.entries.map((entry) => entry.id === original.id ? { ...entry, ...draft, updatedAt: now } : entry) : [...current.entries, { ...draft, id: makeId("entry"), ownerId: current.user!.id, updatedAt: now, review: { stage: 0, dueAt: now } }] }));
    toast(original ? "修改已保存" : "已加入词书"); navigate(`/books/${draft.bookId}`);
  }
  function speakWithBrowser(text: string) {
    if (!("speechSynthesis" in window)) throw new Error("当前浏览器不支持朗读");
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.88;
    speechSynthesis.speak(utterance);
  }
  async function speak(text: string) {
    if (!TTS_ENDPOINT) {
      try { speakWithBrowser(text); } catch (error) { toast(error instanceof Error ? error.message : "朗读失败"); }
      return;
    }
    try {
      const response = await fetch(TTS_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, language: "en-US" }) });
      if (!response.ok) throw new Error("Microsoft Speech 暂不可用");
      const audioUrl = URL.createObjectURL(await response.blob());
      const audio = new Audio(audioUrl);
      audio.addEventListener("ended", () => URL.revokeObjectURL(audioUrl), { once: true });
      await audio.play();
    } catch {
      try { speakWithBrowser(text); } catch (error) { toast(error instanceof Error ? error.message : "朗读失败"); }
    }
  }
  async function submitRating(rating: ReviewRating) {
    const entry = activeReviewEntries[reviewIndex];
    if (!entry || reviewSubmitting) return;
    setReviewSubmitting(true); setReviewError("");
    const reviewedAt = new Date(); const nextReview = scheduleReview(entry.review, rating, reviewedAt);
    try {
      if (API_BASE) {
        const response = await fetch(`${API_BASE}/submitReview`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entryId: entry.id, rating, reviewedAt: reviewedAt.toISOString() }) });
        if (!response.ok) throw new Error("保存失败，当前卡片已保留，请重试");
      }
      const nextCompleted = reviewCompleted + 1; const isLast = reviewIndex + 1 >= activeReviewEntries.length;
      setData((current) => {
        const log: ReviewLog = { id: makeId("log"), ownerId: current.user!.id, entryId: entry.id, rating, reviewedAt: reviewedAt.toISOString(), beforeStage: entry.review.stage, afterStage: nextReview.stage };
        let checkIns = current.checkIns;
        if (isLast) {
          const date = toLocalDateKey(reviewedAt); const existing = checkIns.find((checkIn) => checkIn.date === date);
          checkIns = existing ? checkIns.map((checkIn) => checkIn.id === existing.id ? { ...checkIn, completedAt: reviewedAt.toISOString(), reviewCount: checkIn.reviewCount + nextCompleted } : checkIn) : [...checkIns, { id: makeId("checkin"), ownerId: current.user!.id, date, completedAt: reviewedAt.toISOString(), reviewCount: nextCompleted }];
        }
        return { ...current, entries: current.entries.map((candidate) => candidate.id === entry.id ? { ...candidate, review: nextReview } : candidate), logs: [...current.logs, log], checkIns };
      });
      setReviewCompleted(nextCompleted); setReviewIndex((current) => current + 1); setReviewRevealed(false);
      requestAnimationFrame(() => document.querySelector<HTMLElement>(".mobile-scroll")?.scrollTo({ top: 0 }));
    } catch (error) { setReviewError(error instanceof Error ? error.message : "保存失败，当前卡片已保留，请重试"); }
    finally { setReviewSubmitting(false); }
  }

  let screen: ReactNode;
  if (!data.user) screen = <LoginScreen toast={toast} onLogin={(user) => {
    setData((current) => ({
      ...current,
      user,
      books: current.books.map((book) => ({ ...book, ownerId: user.id })),
      entries: current.entries.map((entry) => ({ ...entry, ownerId: user.id })),
    }));
    navigate("/today");
  }} />;
  else if (path === "/today") screen = <TodayScreen data={data} navigate={navigate} />;
  else if (path === "/books") screen = <BooksScreen data={data} setData={setData} navigate={navigate} toast={toast} />;
  else if (path.startsWith("/books/")) {
    const bookId = path.split("/")[2]; const book = data.books.find((candidate) => candidate.id === bookId);
    screen = book ? <BookDetailScreen book={book} entries={data.entries.filter((entry) => entry.bookId === book.id)} navigate={navigate} onDelete={setDeleteTarget} /> : <div className="page-body"><Header title="词书不存在" onBack={() => navigate("/books")} /></div>;
  } else if (path === "/entries/new" || path.startsWith("/entries/new?")) {
    const bookId = new URLSearchParams(path.split("?")[1] ?? "").get("book") ?? undefined;
    screen = <EntryForm data={data} initialBookId={bookId} navigate={navigate} saveEntry={saveEntry} toast={toast} />;
  } else if (/^\/entries\/[^/]+\/edit$/.test(path)) {
    const entryId = path.split("/")[2]; const entry = data.entries.find((candidate) => candidate.id === entryId);
    screen = entry ? <EntryForm data={data} entry={entry} navigate={navigate} saveEntry={saveEntry} toast={toast} /> : <div className="page-body"><Header title="内容不存在" onBack={() => navigate("/books")} /></div>;
  } else if (path === "/review") {
    const reviewEntries = activeReviewEntries.length ? activeReviewEntries : data.entries.filter((entry) => isDue(entry.review.dueAt));
    screen = reviewEntries.length ? <ReviewScreen entries={reviewEntries} sessionIndex={reviewIndex} revealed={reviewRevealed} completedCount={reviewCompleted} submitting={reviewSubmitting} error={reviewError} navigate={navigate} setRevealed={setReviewRevealed} speak={(text) => void speak(text)} submitRating={(rating) => void submitRating(rating)} /> : <main className="completion-screen"><div className="completion-icon"><CheckCircledIcon /></div><h1>今天已经完成</h1><p>目前没有待复习内容。</p><button className="primary-button" type="button" onClick={() => navigate("/today")}>回到今日</button></main>;
  } else if (path === "/account") screen = <AccountScreen data={data} navigate={navigate} logout={() => setData((current) => ({ ...current, user: null }))} />;
  else screen = <TodayScreen data={data} navigate={navigate} />;

  return <MobileScroll className="app-screen"><div className="prototype-shell">{screen}{toastMessage ? <div className="toast" role="status">{toastMessage}</div> : null}{deleteTarget ? <div className="confirm-backdrop" role="presentation" onClick={() => setDeleteTarget(null)}><section className="confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="delete-title" onClick={(event) => event.stopPropagation()}><div className="danger-icon"><TrashIcon /></div><h2 id="delete-title">删除“{deleteTarget.english}”？</h2><p>复习进度和记录会一并从本地数据中移除，此操作不能撤销。</p><button className="danger-button" type="button" onClick={() => { const bookId = deleteTarget.bookId; setData((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== deleteTarget.id), logs: current.logs.filter((log) => log.entryId !== deleteTarget.id) })); setDeleteTarget(null); toast("内容已删除"); navigate(`/books/${bookId}`); }}>确认删除</button><button className="secondary-button" type="button" onClick={() => setDeleteTarget(null)}>取消</button></section></div> : null}</div></MobileScroll>;
}
