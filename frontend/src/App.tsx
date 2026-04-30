import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import "./App.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassicFormData {
  job_title: string;
  company: string;
  location: string;
}

interface SearchResult {
  raw_query: string;
  google_url: string;
}

interface HistoryItem {
  query: string;
  url: string;
  date: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESETS = [
  {
    label: "🚀 Tech Founders",
    query: "Founders or CEO of tech startups with series A funding",
  },
  {
    label: "🔍 Tech Recruiters",
    query: "Technical Recruiters or Talent Acquisition at top tech companies",
  },
  {
    label: "💻 Senior Devs",
    query: "Senior Software Engineers with React and Node.js experience",
  },
  {
    label: "🎨 Product Designers",
    query: "Senior Product Designers with Figma portfolio",
  },
];

const API_BASE = "https://linkedin-ghost-searcher.onrender.com";

// ─── Auth Modal ───────────────────────────────────────────────────────────────

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);
  const [usage, setUsage] = useState(0);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const switchMode = () => {
    setIsSignUp((v) => !v);
    setEmail("");
    setPassword("");
    setError("");
    setShowPw(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else {
        setError("");
        onSuccess();
        onClose();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setError(error.message);
      else {
        onSuccess();
        onClose();
      }
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  };

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="modal">
        <button className="modal__close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="modal__header">
          <h2 className="modal__title">
            {isSignUp ? "Create Account" : "Welcome back"}
          </h2>
          <p className="modal__sub">
            {isSignUp
              ? "Start finding leads for free."
              : "Sign in to your Ghost account."}
          </p>
        </div>

        <form className="modal__form" onSubmit={handleSubmit}>
          <div className="modal__field">
            <label className="modal__label">Email</label>
            <input
              className="modal__input"
              type="email"
              placeholder="you@example.com"
              value={email}
              autoComplete="off"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="modal__field">
            <label className="modal__label">Password</label>
            <div className="modal__pw-wrap">
              <input
                className="modal__input modal__input--pw"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                autoComplete="off"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="modal__eye"
                onClick={() => setShowPw((s) => !s)}
                aria-label="Toggle password"
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {error && <p className="modal__error">{error}</p>}

          <button type="submit" className="modal__submit" disabled={loading}>
            {loading ? "…" : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="modal__divider">
          <span>or</span>
        </div>

        <button className="modal__google" onClick={handleGoogleLogin}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        <p className="modal__switch">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            className="modal__switch-btn"
            onClick={switchMode}
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  // ── Auth state ───────────────────────────────────────────────────────────
  const [user, setUser] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  // ── Search state ─────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<ClassicFormData>({
    job_title: "",
    company: "",
    location: "",
  });
  const [aiPrompt, setAiPrompt] = useState("");
  const [isSmartMode, setIsSmartMode] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [currentRawQuery, setCurrentRawQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<number>(0);

  // ── History state ─────────────────────────────────────────────────────────
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchUsage = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("search_count")
            .eq("id", session.user.id)
            .single();

          if (data) {
            setUsage(data.search_count);
          }
          if (error) {
            console.error("Supabase error:", error.message);
          }
        } catch (err) {
          console.error("Error fetching usage:", err);
        }
      }
    };

    fetchUsage();
  }, [user]);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setUser(session?.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("search_history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // Prevent body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal]);

  // ── Auth handlers ─────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // ── Search handlers ────────────────────────────────────────────────────────

  const addToHistory = (query: string, url: string) => {
    const next = [
      { query, url, date: new Date().toLocaleTimeString() },
      ...history,
    ].slice(0, 10);
    setHistory(next);
    localStorage.setItem("search_history", JSON.stringify(next));
  };

  const handlePresetClick = (query: string) => {
    setAiPrompt(query);
    setIsSmartMode(true);
  };

  const handleClassicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/generate-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setShowModal(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai-generate-query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_input: aiPrompt }),
      });

      const data = await res.json();

      if (res.ok) {
        setCurrentUrl(data.google_url);
        setCurrentRawQuery(aiPrompt);
        addToHistory(aiPrompt, data.google_url);

        if (data.current_usage !== undefined) {
          setUsage(data.current_usage);
        }
      } else {
        alert(data.detail || "Server error");
      }
    } catch {
      alert("Network error.");
    } finally {
      setLoading(false);
    }
  };

  // ── History handlers ───────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!history.length) return;
    try {
      const res = await fetch(`${API_BASE}/export-csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(history),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
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
          <span className="navbar__logo">Ghost 👻</span>
          <div className="navbar__right">
            {user ? (
              <div className="navbar__profile">
                <span className="navbar__badge">
                  {usage >= 5 ? "⚠️ Limit Reached" : `Used: ${usage} / 5`}
                </span>
                <span className="navbar__email">{user.email}</span>
                <button className="btn btn--ghost-sm" onClick={handleLogout}>
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                className="btn btn--signin"
                onClick={() => setShowModal(true)}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Auth Modal ── */}
      {showModal && (
        <AuthModal
          onClose={() => setShowModal(false)}
          onSuccess={() => setShowModal(false)}
        />
      )}

      {/* ── Main ── */}
      <main className="main">
        {/* Hero */}
        <header className="hero">
          <h1 className="hero__title">Ghost Searcher PRO 👻</h1>
          <p className="hero__sub">
            Bypass LinkedIn limits with Google Dorking
          </p>
        </header>

        {/* Mode toggle */}
        <div className="mode-toggle">
          <button
            type="button"
            className={`mode-toggle__btn${
              !isSmartMode ? " mode-toggle__btn--active" : ""
            }`}
            onClick={() => switchMode(false)}
          >
            Classic
          </button>
          <button
            type="button"
            className={`mode-toggle__btn${
              isSmartMode ? " mode-toggle__btn--active" : ""
            }`}
            onClick={() => switchMode(true)}
          >
            AI Strategist ✨
          </button>
        </div>

        {/* Presets */}
        <section className="presets">
          <p className="presets__label">Quick Templates</p>
          <div className="presets__row">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="preset-chip"
                onClick={() => handlePresetClick(p.query)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {/* Search form */}
        {!isSmartMode ? (
          <form className="search-form" onSubmit={handleClassicSubmit}>
            <input
              className="field"
              type="text"
              placeholder="Job Title"
              value={formData.job_title}
              onChange={(e) =>
                setFormData({ ...formData, job_title: e.target.value })
              }
              required
            />
            <input
              className="field"
              type="text"
              placeholder="Company (optional)"
              value={formData.company}
              onChange={(e) =>
                setFormData({ ...formData, company: e.target.value })
              }
            />
            <input
              className="field"
              type="text"
              placeholder="Location (optional)"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
            />
            <button
              type="submit"
              className="btn btn--primary btn--full"
              disabled={loading}
            >
              {loading ? "Generating…" : "Generate Search URL"}
            </button>
          </form>
        ) : (
          <form className="search-form" onSubmit={handleAiSubmit}>
            <input
              className="field"
              type="text"
              placeholder="e.g. Find senior recruiters at FAANG companies in NYC"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              required
            />
            <button
              type="submit"
              className="btn btn--primary btn--full"
              disabled={loading}
            >
              {loading ? "Thinking…" : "Ask AI Strategist"}
            </button>
          </form>
        )}

        {/* Result */}
        <div className="result-area">
          {loading && (
            <span className="result-area__pulse">Crafting your dork… 🧠</span>
          )}
          {currentUrl && !loading && (
            <div className="result-card">
              <code className="result-card__code">
                {isSmartMode ? "AI-Optimized Query" : currentRawQuery}
              </code>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--outline"
              >
                Open Search 🚀
              </a>
            </div>
          )}
        </div>

        {/* Upgrade nudge */}
        {history.length >= 3 && !user && (
          <div className="upgrade-banner">
            <p>
              Free history limit reached. <strong>Sign in</strong> to unlock
              more.
            </p>
            <button
              className="btn btn--primary btn--sm"
              onClick={() => setShowModal(true)}
            >
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
                  className="btn btn--success btn--sm"
                  onClick={handleExport}
                >
                  Export CSV ↓
                </button>
                <button
                  className="btn btn--danger btn--sm"
                  onClick={clearHistory}
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="history__grid">
              {history.map((item, i) => (
                <a
                  key={i}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="history-card"
                >
                  <span className="history-card__query">{item.query}</span>
                  <small className="history-card__time">{item.date}</small>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;