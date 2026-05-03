import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";
import "./App.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "search" | "pricing";

interface Profile {
  search_count: number;
  is_pro:       boolean;
  plan_type:    "free" | "pro";
}

interface ClassicFormData {
  job_title: string;
  company:   string;
  location:  string;
}

interface SearchResult {
  raw_query:     string;
  google_url:    string;
  current_usage?: number;
}

interface HistoryItem {
  query: string;
  url:   string;
  date:  string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FREE_LIMIT = 5;
const API_BASE   = "https://linkedin-ghost-searcher.onrender.com";

const PRESETS = [
  { label: "🚀 Tech Founders",     query: "Founders or CEO of tech startups with series A funding" },
  { label: "🔍 Tech Recruiters",   query: "Technical Recruiters or Talent Acquisition at top tech companies" },
  { label: "💻 Senior Devs",       query: "Senior Software Engineers with React and Node.js experience" },
  { label: "🎨 Product Designers", query: "Senior Product Designers with Figma portfolio" },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("NOT_LOGGED_IN");
  return `Bearer ${session.access_token}`;
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────

interface AuthModalProps {
  onClose:   () => void;
  onSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const overlayRef              = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const switchMode = () => {
    setIsSignUp(v => !v);
    setEmail(""); setPassword(""); setError(""); setShowPw(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message); else { onSuccess(); onClose(); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message); else { onSuccess(); onClose(); }
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google", options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="modal-overlay" ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="modal">
        <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        <div className="modal__header">
          <h2 className="modal__title">{isSignUp ? "Create Account" : "Welcome back"}</h2>
          <p className="modal__sub">{isSignUp ? "Start finding leads for free." : "Sign in to your Ghost account."}</p>
        </div>
        <form className="modal__form" onSubmit={handleSubmit}>
          <div className="modal__field">
            <label className="modal__label">Email</label>
            <input className="modal__input" type="email" placeholder="you@example.com"
              value={email} autoComplete="off" onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="modal__field">
            <label className="modal__label">Password</label>
            <div className="modal__pw-wrap">
              <input className="modal__input modal__input--pw"
                type={showPw ? "text" : "password"} placeholder="••••••••"
                value={password} autoComplete="off"
                onChange={e => setPassword(e.target.value)} required />
              <button type="button" className="modal__eye"
                onClick={() => setShowPw(s => !s)} aria-label="Toggle password">
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          {error && <p className="modal__error">{error}</p>}
          <button type="submit" className="modal__submit" disabled={loading}>
            {loading ? "…" : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>
        <div className="modal__divider"><span>or</span></div>
        <button className="modal__google" onClick={handleGoogle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
        <p className="modal__switch">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" className="modal__switch-btn" onClick={switchMode}>
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
};

// ─── Usage Bar ────────────────────────────────────────────────────────────────

const UsageBar: React.FC<{ usage: number; limit: number; isPro: boolean }> = ({ usage, limit, isPro }) => {
  if (isPro) return (
    <div className="usage-bar">
      <span className="usage-bar__pro">✦ PRO</span>
    </div>
  );
  const pct     = Math.min((usage / limit) * 100, 100);
  const isMaxed = usage >= limit;
  return (
    <div className="usage-bar" title={`${usage} / ${limit} free searches used`}>
      <div className={`usage-bar__track${isMaxed ? " usage-bar__track--maxed" : ""}`}>
        <div className="usage-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className={`usage-bar__label${isMaxed ? " usage-bar__label--maxed" : ""}`}>
        {isMaxed ? "Limit" : `${usage}/${limit}`}
      </span>
    </div>
  );
};

// ─── Pricing View ─────────────────────────────────────────────────────────────

interface PricingViewProps {
  isPro:        boolean;
  onSignIn:     () => void;
  isLoggedIn:   boolean;
}

const PRICING_FREE_FEATURES = [
  "5 searches per day",
  "Classic Dorking mode",
  "Search history (local)",
  "Quick presets",
];

const PRICING_PRO_FEATURES = [
  "Unlimited searches",
  "AI Strategist mode",
  "CSV export of leads",
  "Priority support",
  "Early access to new features",
];

const PricingView: React.FC<PricingViewProps> = ({ isPro, onSignIn, isLoggedIn }) => (
  <div className="pricing">
    <header className="pricing__hero">
      <h1 className="pricing__title">Simple, honest pricing</h1>
      <p className="pricing__sub">Start for free. Upgrade when you need more power.</p>
    </header>

    <div className="pricing__grid">

      {/* Free card */}
      <div className="plan-card">
        <div className="plan-card__header">
          <span className="plan-card__name">Free</span>
          <div className="plan-card__price">
            <span className="plan-card__amount">$0</span>
            <span className="plan-card__period">/month</span>
          </div>
          <p className="plan-card__tagline">Good enough to get started.</p>
        </div>
        <ul className="plan-card__features">
          {PRICING_FREE_FEATURES.map(f => (
            <li key={f} className="plan-card__feature">
              <span className="plan-card__check">✓</span> {f}
            </li>
          ))}
          <li className="plan-card__feature plan-card__feature--locked">
            <span className="plan-card__lock">✕</span> AI Strategist
          </li>
          <li className="plan-card__feature plan-card__feature--locked">
            <span className="plan-card__lock">✕</span> CSV Export
          </li>
        </ul>
        <div className="plan-card__cta">
          {isLoggedIn
            ? <button className="btn btn--outline btn--full" disabled>Current plan</button>
            : <button className="btn btn--outline btn--full" onClick={onSignIn}>Get started free</button>
          }
        </div>
      </div>

      {/* PRO card */}
      <div className="plan-card plan-card--pro">
        <div className="plan-card__badge">Most popular</div>
        <div className="plan-card__header">
          <span className="plan-card__name">Ghost PRO</span>
          <div className="plan-card__price">
            <span className="plan-card__amount">$19</span>
            <span className="plan-card__period">/month</span>
          </div>
          <p className="plan-card__tagline">For serious lead hunters.</p>
        </div>
        <ul className="plan-card__features">
          {PRICING_PRO_FEATURES.map(f => (
            <li key={f} className="plan-card__feature">
              <span className="plan-card__check plan-card__check--pro">✓</span> {f}
            </li>
          ))}
        </ul>
        <div className="plan-card__cta">
          {isPro
            ? <button className="btn btn--primary btn--full" disabled>✦ Active plan</button>
            : <button className="btn btn--primary btn--full"
                onClick={() => alert("Stripe integration coming soon 🚀")}>
                Upgrade to PRO
              </button>
          }
        </div>
      </div>

    </div>

    <p className="pricing__note">
      All plans include a 7-day money-back guarantee. No questions asked.
    </p>
  </div>
);

// ─── Main App ─────────────────────────────────────────────────────────────────

const App: React.FC = () => {

  // ── View / Nav ────────────────────────────────────────────────────────────
  const [view, setView] = useState<View>("search");

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user,      setUser]      = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // ── Profile / subscription ────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile>({ search_count: 0, is_pro: false, plan_type: "free" });
  const isPro     = profile.is_pro || profile.plan_type === "pro";
  const usage     = profile.search_count;
  const isLimited = !isPro && usage >= FREE_LIMIT;

  // ── Search ────────────────────────────────────────────────────────────────
  const [formData, setFormData]               = useState<ClassicFormData>({ job_title: "", company: "", location: "" });
  const [aiPrompt, setAiPrompt]               = useState("");
  const [isSmartMode, setIsSmartMode]         = useState(false);
  const [currentUrl, setCurrentUrl]           = useState<string | null>(null);
  const [currentRawQuery, setCurrentRawQuery] = useState("");
  const [loading, setLoading]                 = useState(false);

  // ── History ───────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setProfile({ search_count: 0, is_pro: false, plan_type: "free" }); return; }
    const { data } = await supabase
      .from("profiles")
      .select("search_count, is_pro, plan_type")
      .eq("id", session.user.id)
      .single();
    if (data) setProfile(data as Profile);
  }, []);

  useEffect(() => {
    if (user) fetchProfile(); else setProfile({ search_count: 0, is_pro: false, plan_type: "free" });
  }, [user, fetchProfile]);

  useEffect(() => {
    const saved = localStorage.getItem("search_history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showModal]);

  // ── Auth handlers ─────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile({ search_count: 0, is_pro: false, plan_type: "free" });
  };

  // ── History ───────────────────────────────────────────────────────────────

  const addToHistory = (query: string, url: string) => {
    const next = [{ query, url, date: new Date().toLocaleTimeString() }, ...history].slice(0, 10);
    setHistory(next);
    localStorage.setItem("search_history", JSON.stringify(next));
  };

  // ── Search handlers ────────────────────────────────────────────────────────

  const handlePresetClick = (query: string) => {
    setAiPrompt(query);
    setIsSmartMode(true);
  };

  const handleClassicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/generate-query`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(formData),
      });
      const data: SearchResult = await res.json();
      setCurrentUrl(data.google_url);
      setCurrentRawQuery(data.raw_query);
      addToHistory(formData.job_title, data.google_url);
    } catch {
      alert("Failed to generate URL. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setShowModal(true); return; }

    // Paywall check
    if (!isPro && usage >= FREE_LIMIT) {
      setView("pricing");
      return;
    }

    setLoading(true);
    try {
      const auth = await getAuthHeader();
      const res  = await fetch(`${API_BASE}/ai-generate-query`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body:    JSON.stringify({ user_input: aiPrompt }),
      });
      const data = await res.json();

      if (res.status === 403) {
        setProfile(p => ({ ...p, search_count: FREE_LIMIT }));
        setView("pricing");
        return;
      }
      if (!res.ok) { alert(data.detail || "Server error"); return; }

      setCurrentUrl(data.google_url);
      setCurrentRawQuery(aiPrompt);
      addToHistory(aiPrompt, data.google_url);

      if (data.current_usage !== undefined) {
        setProfile(p => ({ ...p, search_count: data.current_usage }));
      }
    } catch (err: any) {
      if (err.message === "NOT_LOGGED_IN") { setShowModal(true); return; }
      alert("Network error.");
    } finally {
      setLoading(false);
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!history.length) return;

    // CSV is PRO-only
    if (!isPro) {
      setView("pricing");
      return;
    }

    if (!user) { setShowModal(true); return; }

    try {
      const auth = await getAuthHeader();
      const res  = await fetch(`${API_BASE}/export-csv`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body:    JSON.stringify(history),
      });

      if (res.status === 403) { setView("pricing"); return; }

      const newCount = res.headers.get("X-Usage");
      if (newCount) setProfile(p => ({ ...p, search_count: Number(newCount) }));

      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `linkedin_leads_${new Date().toLocaleDateString()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Export failed.");
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("search_history");
  };

  const switchMode = (smart: boolean) => {
    setIsSmartMode(smart);
    setCurrentUrl(null);
    setCurrentRawQuery("");
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app">

      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="navbar__inner">
          <button className="navbar__logo" onClick={() => setView("search")}>Ghost 👻</button>

          <div className="navbar__nav">
            <button
              className={`navbar__nav-btn${view === "search" ? " navbar__nav-btn--active" : ""}`}
              onClick={() => setView("search")}>
              Search
            </button>
            <button
              className={`navbar__nav-btn${view === "pricing" ? " navbar__nav-btn--active" : ""}`}
              onClick={() => setView("pricing")}>
              Pricing
            </button>
          </div>

          <div className="navbar__right">
            {user ? (
              <div className="navbar__profile">
                <UsageBar usage={usage} limit={FREE_LIMIT} isPro={isPro} />
                <span className="navbar__email">{user.email}</span>
                <button className="btn btn--ghost-sm" onClick={handleLogout}>Sign Out</button>
              </div>
            ) : (
              <button className="btn btn--signin" onClick={() => setShowModal(true)}>Sign In</button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Auth Modal ── */}
      {showModal && (
        <AuthModal
          onClose={()   => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchProfile(); }}
        />
      )}

      {/* ── Views ── */}
      {view === "pricing" ? (
        <main className="main">
          <PricingView
            isPro={isPro}
            isLoggedIn={!!user}
            onSignIn={() => setShowModal(true)}
          />
        </main>
      ) : (
        <main className="main">

          <header className="hero">
            <h1 className="hero__title">Ghost Searcher PRO 👻</h1>
            <p className="hero__sub">Bypass LinkedIn limits with Google Dorking</p>
          </header>

          {/* Mode toggle */}
          <div className="mode-toggle">
            <button type="button"
              className={`mode-toggle__btn${!isSmartMode ? " mode-toggle__btn--active" : ""}`}
              onClick={() => switchMode(false)}>
              Classic
            </button>
            <button type="button"
              className={`mode-toggle__btn${isSmartMode ? " mode-toggle__btn--active" : ""}`}
              onClick={() => switchMode(true)}>
              AI Strategist ✨ {!isPro && <span className="mode-toggle__pro-tag">PRO</span>}
            </button>
          </div>

          {/* Presets */}
          <section className="presets">
            <p className="presets__label">Quick Templates</p>
            <div className="presets__row">
              {PRESETS.map(p => (
                <button key={p.label} className="preset-chip" onClick={() => handlePresetClick(p.query)}>
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {/* Limit banner */}
          {isLimited && (
            <div className="limit-banner">
              <div className="limit-banner__body">
                <strong>Free limit reached ({FREE_LIMIT}/{FREE_LIMIT})</strong>
                <p>AI Strategist and CSV export are locked on the free plan.</p>
              </div>
              <button className="btn btn--upgrade btn--sm" onClick={() => setView("pricing")}>
                Upgrade to PRO 🚀
              </button>
            </div>
          )}

          {/* Search forms */}
          {!isSmartMode ? (
            <form className="search-form" onSubmit={handleClassicSubmit}>
              <input className="field" type="text" placeholder="Job Title"
                value={formData.job_title}
                onChange={e => setFormData({ ...formData, job_title: e.target.value })} required />
              <input className="field" type="text" placeholder="Company (optional)"
                value={formData.company}
                onChange={e => setFormData({ ...formData, company: e.target.value })} />
              <input className="field" type="text" placeholder="Location (optional)"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })} />
              <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
                {loading ? "Generating…" : "Generate Search URL"}
              </button>
            </form>
          ) : (
            <form className="search-form" onSubmit={handleAiSubmit}>
              {isLimited && (
                <div className="search-form__paywall">
                  🔒 AI Strategist requires Ghost PRO.{" "}
                  <button type="button" className="search-form__paywall-link" onClick={() => setView("pricing")}>
                    See plans →
                  </button>
                </div>
              )}
              <input className="field" type="text"
                placeholder="e.g. Find senior recruiters at FAANG companies in NYC"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                disabled={isLimited}
                required />
              <button type="submit"
                className={`btn btn--full${isLimited ? " btn--locked" : " btn--primary"}`}
                disabled={loading || isLimited}>
                {isLimited ? "🔒 Upgrade to Unlock" : loading ? "Thinking…" : "Ask AI Strategist"}
              </button>
            </form>
          )}

          {/* Result */}
          <div className="result-area">
            {loading && <span className="result-area__pulse">Crafting your dork… 🧠</span>}
            {currentUrl && !loading && (
              <div className="result-card">
                <code className="result-card__code">
                  {isSmartMode ? "AI-Optimized Query" : currentRawQuery}
                </code>
                <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="btn btn--outline">
                  Open Search 🚀
                </a>
              </div>
            )}
          </div>

          {/* Sign-in nudge (anonymous users) */}
          {history.length >= 3 && !user && (
            <div className="upgrade-banner">
              <p>Free history limit reached. <strong>Sign in</strong> to unlock more.</p>
              <button className="btn btn--primary btn--sm" onClick={() => setShowModal(true)}>
                Sign In Free
              </button>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <section className="history">
              <div className="history__head">
                <span className="history__label">Recent Searches</span>
                <div className="history__actions">
                  <button
                    className={`btn btn--sm${isPro ? " btn--success" : " btn--locked"}`}
                    onClick={handleExport}
                    title={isPro ? "Export to CSV" : "CSV Export is a PRO feature"}>
                    {isPro ? "Export CSV ↓" : "🔒 Export CSV"}
                  </button>
                  <button className="btn btn--danger btn--sm" onClick={clearHistory}>
                    Clear All
                  </button>
                </div>
              </div>
              <div className="history__grid">
                {history.map((item, i) => (
                  <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="history-card">
                    <span className="history-card__query">{item.query}</span>
                    <small className="history-card__time">{item.date}</small>
                  </a>
                ))}
              </div>
            </section>
          )}

        </main>
      )}
    </div>
  );
};

export default App;