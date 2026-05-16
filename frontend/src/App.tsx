import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";
import "./App.scss";

declare global {
  interface Window {
    LemonSqueezy: {
      Url: { Open: (url: string) => void };
    };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "search" | "pricing";

interface Profile {
  search_count: number;
  is_pro: boolean;
  plan_type: "free" | "pro";
}

interface ClassicFormData {
  job_title: string;
  company: string;
  location: string;
}

interface SearchResult {
  raw_query: string;
  google_url: string;
  current_usage?: number;
  detail?: string;
}

interface HistoryItem {
  query: string;
  url: string;
  date: string;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FREE_LIMIT = 5;
const ANON_STORAGE_KEY = "ghostin_free_searches";
const ANON_FREE_LIMIT = 5;
const API_BASE = "https://linkedin-ghost-searcher.onrender.com";

const LS_CHECKOUT_URL =
  "https://linkedin-ghost-searcher.lemonsqueezy.com/checkout/buy/d77f43c8-0c4d-4774-812e-49e17ec475ae?embed=1";

const DISPOSABLE_DOMAINS = new Set([
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "guerrillamail.com",
  "mailinator.com",
  "yopmail.com",
  "throwam.com",
  "spam4.me",
  "trashmail.com",
  "trashmail.me",
  "trashmail.net",
  "10minutemail.com",
  "fakeinbox.com",
  "maildrop.cc",
  "tempr.email",
  "discard.email",
  "mailnull.com",
  "spamgourmet.com",
  "dispostable.com",
  "sharklasers.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "grr.la",
]);

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

const PRICING_FREE_FEATURES = [
  "5 searches per day",
  "Classic Dorking mode",
  "Search history (local)",
  "Quick templates",
];

const PRICING_PRO_FEATURES = [
  "Unlimited searches",
  "AI Strategist mode",
  "CSV export of leads",
  "Priority support",
  "Early access to new features",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthHeader(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("NOT_LOGGED_IN");
  return `Bearer ${session.access_token}`;
}

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return DISPOSABLE_DOMAINS.has(domain);
}

// ─── Toast system ─────────────────────────────────────────────────────────────

let toastIdCounter = 0;

const ToastContainer: React.FC<{
  toasts: Toast[];
  onRemove: (id: number) => void;
}> = ({ toasts, onRemove }) => (
  <div className="toast-container">
    {toasts.map((t) => (
      <div key={t.id} className={`toast toast--${t.type}`}>
        <span>{t.message}</span>
        <button className="toast__close" onClick={() => onRemove(t.id)}>
          ✕
        </button>
      </div>
    ))}
  </div>
);

// ─── Auth Modal ───────────────────────────────────────────────────────────────

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onToast: (message: string, type: Toast["type"]) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({
  onClose,
  onSuccess,
  onToast,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
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

    if (isSignUp && isDisposableEmail(email)) {
      setError(
        "Please use a real email address. Temporary emails are not allowed."
      );
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
      });
      if (err) {
        setError(err.message);
      } else if (!data.session) {
        onToast("Check your inbox for a confirmation link!", "success");
        onClose();
      } else {
        onSuccess();
        onClose();
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) setError(err.message);
      else {
        onSuccess();
        onClose();
      }
    }

    setLoading(false);
  };

  const handleGoogle = async () => {
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (err) setError(err.message);
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
              : "Sign in to your GhostIn account."}
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
        <button className="modal__google" onClick={handleGoogle}>
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

// ─── Usage Bar ────────────────────────────────────────────────────────────────

const UsageBar: React.FC<{ usage: number; limit: number; isPro: boolean }> = ({
  usage,
  limit,
  isPro,
}) => {
  if (isPro)
    return (
      <div className="usage-bar">
        <span className="usage-bar__pro">✦ PRO</span>
      </div>
    );
  const pct = Math.min((usage / limit) * 100, 100);
  const isMaxed = usage >= limit;
  return (
    <div className="usage-bar" title={`${usage} / ${limit} free searches used`}>
      <div
        className={`usage-bar__track${
          isMaxed ? " usage-bar__track--maxed" : ""
        }`}
      >
        <div className="usage-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <span
        className={`usage-bar__label${
          isMaxed ? " usage-bar__label--maxed" : ""
        }`}
      >
        {isMaxed ? "Limit" : `${usage}/${limit}`}
      </span>
    </div>
  );
};

// ─── Pricing View ─────────────────────────────────────────────────────────────

interface PricingViewProps {
  isPro: boolean;
  isLoggedIn: boolean;
  onSignIn: () => void;
}

const PricingView: React.FC<PricingViewProps> = ({
  isPro,
  isLoggedIn,
  onSignIn,
}) => {
  const handleUpgrade = () => {
    if (!isLoggedIn) {
      onSignIn();
      return;
    }

    if (typeof window.LemonSqueezy !== "undefined") {
      window.LemonSqueezy.Url.Open(LS_CHECKOUT_URL);
    } else {
      window.open(LS_CHECKOUT_URL.replace("?embed=1", ""), "_blank");
    }
  };

  return (
    <div className="pricing">
      <header className="pricing__hero">
        <h1 className="pricing__title">Get the data LinkedIn hides from you</h1>

        <p className="pricing__sub">
          Start for free. Upgrade when you need more power.
        </p>
      </header>

      <div className="pricing__grid">
        {/* FREE */}
        <div
          className={`plan-card ${
            !isPro ? "plan-card--active" : "plan-card--inactive"
          }`}
        >
          <div className="plan-card__header">
            <span className="plan-card__name">Free</span>

            <div className="plan-card__price">
              <span className="plan-card__amount">$0</span>
              <span className="plan-card__period">/month</span>
            </div>

            <p className="plan-card__tagline">Good enough to get started.</p>
          </div>

          <ul className="plan-card__features">
            {PRICING_FREE_FEATURES.map((f) => (
              <li key={f} className="plan-card__feature">
                <span className="plan-card__check">✓</span>
                {f}
              </li>
            ))}

            <li className="plan-card__feature plan-card__feature--locked">
              <span className="plan-card__lock">✕</span>
              AI Strategist
            </li>

            <li className="plan-card__feature plan-card__feature--locked">
              <span className="plan-card__lock">✕</span>
              CSV Export
            </li>
          </ul>

          <div className="plan-card__cta">
            {!isPro ? (
              <button className="btn btn--outline btn--full" disabled>
                Current Plan
              </button>
            ) : (
              <button className="btn btn--outline btn--full" disabled>
                Basic Access
              </button>
            )}
          </div>
        </div>

        {/* PRO */}
        <div
          className={`plan-card plan-card--pro ${
            isPro ? "plan-card--active" : "plan-card--inactive"
          }`}
        >
          <div className="plan-card__badge">Most popular</div>

          <div className="plan-card__header">
            <span className="plan-card__name">GhostIn PRO</span>

            <div className="plan-card__price">
              <span className="plan-card__amount">$19</span>
              <span className="plan-card__period">/month</span>
            </div>

            <p className="plan-card__tagline">For serious lead hunters.</p>
          </div>

          <ul className="plan-card__features">
            {PRICING_PRO_FEATURES.map((f) => (
              <li key={f} className="plan-card__feature">
                <span className="plan-card__check plan-card__check--pro">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>

          <div className="plan-card__cta">
            {isPro ? (
              <button className="btn btn--primary btn--full" disabled>
                ✦ Active Plan
              </button>
            ) : (
              <button
                className="btn btn--primary btn--full"
                onClick={handleUpgrade}
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="pricing__note">
        All plans include a 7-day money-back guarantee.
      </p>
    </div>
  );
};

// ─── Anon free-search counter (localStorage) ──────────────────────────────────
function getAnonSearches(): number {
  try {
    const raw = localStorage.getItem(ANON_STORAGE_KEY);
    if (raw === null) {
      localStorage.setItem(ANON_STORAGE_KEY, String(ANON_FREE_LIMIT));
      return ANON_FREE_LIMIT;
    }
    const n = parseInt(raw, 10);
    return isNaN(n) ? ANON_FREE_LIMIT : Math.max(0, n);
  } catch {
    return ANON_FREE_LIMIT;
  }
}

function decrementAnonSearches(): number {
  const next = Math.max(0, getAnonSearches() - 1);
  try {
    localStorage.setItem(ANON_STORAGE_KEY, String(next));
  } catch {}
  return next;
}

function useAnonSearches(isLoggedIn: boolean) {
  const [count, setCount] = useState<number>(() =>
    isLoggedIn ? ANON_FREE_LIMIT : getAnonSearches()
  );

  useEffect(() => {
    if (!isLoggedIn) setCount(getAnonSearches());
  }, [isLoggedIn]);

  const decrement = useCallback(() => {
    setCount(decrementAnonSearches());
  }, []);

  return { count, decrement };
}

// ─── Anon Counter Strip ────────────────────────────────────────────────────────
const AnonCounter: React.FC<{ count: number }> = ({ count }) => {
  const isLow = count <= 2;
  return (
    <div className={`anon-counter${isLow ? " anon-counter--low" : ""}`}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      Free searches left:{" "}
      <strong>
        {count}/{ANON_FREE_LIMIT}
      </strong>
    </div>
  );
};

// ─── Paywall Modal (anon limit) ───────────────────────────────────────────────
interface PaywallModalProps {
  onSignUp: () => void;
  onUpgrade: () => void;
  onClose: () => void;
}

const PaywallModal: React.FC<PaywallModalProps> = ({
  onSignUp,
  onUpgrade,
  onClose,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="modal modal--paywall">
        <button className="modal__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="modal__header">
          <div className="modal__paywall-icon">👻</div>
          <h2 className="modal__title">You've hit the limit!</h2>
          <p className="modal__sub">
            To unlock unlimited searches, download candidates to CSV, and use
            the full power of the AI Strategist — create a free account or
            upgrade to PRO for just $19/mo.
          </p>
        </div>
        <div className="modal__paywall-actions">
          <button className="btn btn--primary btn--full" onClick={onSignUp}>
            Sign Up for Free
          </button>
          <button className="btn btn--upgrade btn--full" onClick={onUpgrade}>
            Get PRO for $19 🚀
          </button>
        </div>
        <p className="modal__paywall-note">
          No credit card required for free account.
        </p>
      </div>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [view, setView] = useState<View>("search");
  const [user, setUser] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    search_count: 0,
    is_pro: false,
    plan_type: "free",
  });
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
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isFirstSearch, setIsFirstSearch] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const isPro = profile?.is_pro === true || profile?.plan_type === "pro";
  const usage = profile.search_count;
  const isLimited = !isPro && usage >= FREE_LIMIT;
  const { count: anonCount, decrement: decrementAnon } = useAnonSearches(
    !!user
  );
  const [showPaywall, setShowPaywall] = useState(false);
  const isAnonLimited = !user && anonCount <= 0;

  const addToast = useCallback(
    (message: string, type: Toast["type"] = "info") => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        4000
      );
    },
    []
  );

  // ── Auth + profile ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleOutside);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleOutside);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setUser(session?.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setProfile({ search_count: 0, is_pro: false, plan_type: "free" });
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("search_count, is_pro, plan_type")
      .eq("id", session.user.id)
      .single();
    if (data) setProfile(data as Profile);
  }, []);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user, fetchProfile]);

  useEffect(() => {
    const saved = localStorage.getItem("search_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        localStorage.removeItem("search_history");
      }
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = showModal || showHistory ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal, showHistory]);

  // Supabase Realtime
  useEffect(() => {
    if (!user || channelRef.current) return;
    const channel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => fetchProfile()
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, fetchProfile]);

  // LemonSqueezy overlay payment success
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (
        e.data?.event === "Lemon.OrderCreated" ||
        e.data?.event === "Lemon.SubscriptionCreated"
      ) {
        fetchProfile();
        addToast(
          "Payment confirmed! Your PRO access is now active. ✦",
          "success"
        );
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchProfile, addToast]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    const confirmed = window.confirm("Are you sure you want to sign out?");

    if (!confirmed) return;

    await supabase.auth.signOut();
    setUser(null);
    setProfile({ search_count: 0, is_pro: false, plan_type: "free" });
    setAiPrompt("");
    setIsMenuOpen(false);
  };

  const addToHistory = (query: string, url: string) => {
    const next = [
      { query, url, date: new Date().toLocaleTimeString() },
      ...history,
    ].slice(0, 50);
    setHistory(next);
    localStorage.setItem("search_history", JSON.stringify(next));
  };

  const clearHistory = () => {
    if (!window.confirm("Clear all search history? This cannot be undone."))
      return;
    setHistory([]);
    localStorage.removeItem("search_history");
    setShowHistory(false);
  };

  const handlePresetClick = (query: string) => {
    if (!isPro) {
      const cleaned = query
        .split(" at ")[0]
        .split(" or ")[0]
        .split(" with ")[0]
        .trim();
      setFormData({ job_title: cleaned, company: "", location: "" });
      setIsSmartMode(false);
    } else {
      setAiPrompt(query);
      setIsSmartMode(true);
    }
    setCurrentUrl(null);
    setCurrentRawQuery("");
  };

  const switchMode = (smart: boolean) => {
    setIsSmartMode(smart);
    setCurrentUrl(null);
    setCurrentRawQuery("");
  };

  const handleClassicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && anonCount <= 0) {
      setShowPaywall(true);
      return;
    }
    if (user && isLimited) {
      setView("pricing");
      return;
    }
    setLoading(true);
    try {
      // Собираем заголовки: если юзер есть — берем токен, если нет — шлем без него
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (user) {
        const auth = await getAuthHeader();
        headers["Authorization"] = auth;
      }

      const res = await fetch(`${API_BASE}/generate-query`, {
        method: "POST",
        headers,
        body: JSON.stringify(formData),
      });
      const data: SearchResult = await res.json();
      if (res.status === 403) {
        setProfile((p) => ({ ...p, search_count: FREE_LIMIT }));
        setView("pricing");
        return;
      }
      if (!res.ok) {
        addToast(data.detail || "Server error. Please try again.", "error");
        return;
      }
      setCurrentUrl(data.google_url);
      setIsFirstSearch(false);
      setCurrentRawQuery(data.raw_query);
      addToHistory(formData.job_title, data.google_url);

      // Уменьшаем счетчик анонима локально ТОЛЬКО после успешного поиска
      if (!user) decrementAnon();

      if (typeof data.current_usage === "number" && user)
        setProfile((p) => ({
          ...p,
          search_count: data.current_usage as number,
        }));
    } catch (err: any) {
      if (err.message === "NOT_LOGGED_IN" && user) setShowModal(true);
      else
        addToast(
          "Network or server error. Please check your connection.",
          "error"
        );
    } finally {
      setLoading(false);
    }
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && anonCount <= 0) {
      setShowPaywall(true);
      return;
    }
    if (!user) {
      setShowModal(true);
      return;
    }
    if (!isPro) {
      setView("pricing");
      return;
    }
    if (isLimited) {
      setView("pricing");
      return;
    }
    setLoading(true);
    try {
      const auth = await getAuthHeader();
      const res = await fetch(`${API_BASE}/ai-generate-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({ user_input: aiPrompt }),
      });
      const data = await res.json();
      if (res.status === 403) {
        setView("pricing");
        return;
      }
      if (!res.ok) {
        addToast(data.detail || "Server error. Please try again.", "error");
        return;
      }
      setCurrentUrl(data.google_url);
      setIsFirstSearch(false);
      setCurrentRawQuery(aiPrompt);
      addToHistory(aiPrompt, data.google_url);
      if (typeof data.current_usage === "number")
        setProfile((p) => ({ ...p, search_count: data.current_usage }));
    } catch (err: any) {
      if (err.message === "NOT_LOGGED_IN") setShowModal(true);
      else addToast("Network error. Please check your connection.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!history.length) {
      addToast("No searches to export yet.", "info");
      return;
    }
    if (!isPro) {
      setView("pricing");
      return;
    }
    if (!user) {
      setShowModal(true);
      return;
    }
    try {
      const auth = await getAuthHeader();
      const res = await fetch(`${API_BASE}/export-csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify(history),
      });
      if (res.status === 403) {
        setView("pricing");
        return;
      }
      if (!res.ok) {
        addToast("Export failed. Please try again.", "error");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `linkedin_leads_${new Date().toLocaleDateString()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast("CSV exported successfully!", "success");
    } catch {
      addToast("Export failed. Please try again.", "error");
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      <ToastContainer
        toasts={toasts}
        onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="navbar__inner">
          {/* Логотип */}
          <button
            className="navbar__logo"
            onClick={() => {
              setView("search");
              setIsMenuOpen(false);
            }}
          >
            GhostIn
          </button>

          {/* Центральные ссылки — только десктоп */}
          <div className="navbar__nav">
            <button
              className={`navbar__nav-btn${
                view === "search" ? " navbar__nav-btn--active" : ""
              }`}
              onClick={() => setView("search")}
            >
              Search
            </button>
            <button
              className={`navbar__nav-btn${
                view === "pricing" ? " navbar__nav-btn--active" : ""
              }`}
              onClick={() => setView("pricing")}
            >
              Pricing
            </button>
            <a className="navbar__nav-btn" href="mailto:funguy000001@gmail.com">
              Support
            </a>
          </div>

          {/* Правая часть */}
          <div className="navbar__right">
            {user ? (
              <>
                {/* UsageBar / PRO badge */}
                <UsageBar usage={usage} limit={FREE_LIMIT} isPro={isPro} />

                {/* Email — скрыт на мобилке */}
                <span className="navbar__email">{user.email}</span>

                {/* Sign Out — текст на десктопе, SVG на мобилке */}
                <button
                  className="btn btn--ghost-sm navbar__auth--desktop"
                  onClick={handleLogout}
                >
                  Sign Out
                </button>
                <button
                  className="navbar__icon-btn navbar__auth--mobile"
                  onClick={handleLogout}
                  aria-label="Sign Out"
                >
                  {/* Дверь с выходом */}
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                {/* Sign In — текст на десктопе, SVG на мобилке */}
                <button
                  className="btn btn--signin navbar__auth--desktop"
                  onClick={() => setShowModal(true)}
                >
                  Sign In
                </button>
                <button
                  className="navbar__icon-btn navbar__auth--mobile"
                  onClick={() => setShowModal(true)}
                  aria-label="Sign In"
                >
                  {/* Дверь со входом */}
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </button>
              </>
            )}

            {/* Бургер — только мобилка */}
            <button
              className={`navbar__burger${
                isMenuOpen ? " navbar__burger--open" : ""
              }`}
              onClick={() => setIsMenuOpen((v: boolean) => !v)}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          {/* Мобильное меню */}
          {isMenuOpen && (
            <div className="navbar__dropdown">
              <button
                className={`navbar__dropdown-item${
                  view === "search" ? " navbar__dropdown-item--active" : ""
                }`}
                onClick={() => {
                  setView("search");
                  setIsMenuOpen(false);
                }}
              >
                Search
              </button>
              <button
                className={`navbar__dropdown-item${
                  view === "pricing" ? " navbar__dropdown-item--active" : ""
                }`}
                onClick={() => {
                  setView("pricing");
                  setIsMenuOpen(false);
                }}
              >
                Pricing
              </button>
              <a
                className="navbar__dropdown-item"
                href="mailto:funguy000001@gmail.com"
                onClick={() => setIsMenuOpen(false)}
              >
                Support
              </a>
              {user && (
                <div className="navbar__dropdown-email">{user.email}</div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* ── Auth modal ── */}
      {showModal && (
        <AuthModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchProfile();
          }}
          onToast={addToast}
        />
      )}

      {/* ── Paywall modal ── */}
      {showPaywall && (
        <PaywallModal
          onSignUp={() => {
            setShowPaywall(false);
            setShowModal(true);
          }}
          onUpgrade={() => {
            setShowPaywall(false);
            if (typeof window.LemonSqueezy !== "undefined") {
              window.LemonSqueezy.Url.Open(LS_CHECKOUT_URL);
            } else {
              window.open(LS_CHECKOUT_URL.replace("?embed=1", ""), "_blank");
            }
          }}
          onClose={() => setShowPaywall(false)}
        />
      )}

      {/* ── History modal ── */}
      {showHistory && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.currentTarget === e.target) setShowHistory(false);
          }}
        >
          <div className="modal modal--history">
            <button
              className="modal__close"
              onClick={() => setShowHistory(false)}
              aria-label="Close"
            >
              ✕
            </button>
            <div className="modal__header">
              <h2 className="modal__title">Search History</h2>
              <p className="modal__sub">
                {history.length} searches saved locally
              </p>
            </div>
            <div className="history-modal__list">
              {history.map((item, i) => (
                <a
                  key={i}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="history-modal__item"
                >
                  <span className="history-modal__query">{item.query}</span>
                  <small className="history-modal__time">{item.date}</small>
                </a>
              ))}
            </div>
            <button className="btn btn--danger btn--sm" onClick={clearHistory}>
              Clear History
            </button>
          </div>
        </div>
      )}

      {/* ── Pricing view ── */}
      {view === "pricing" && (
        <main className="main">
          <PricingView
            isPro={isPro}
            isLoggedIn={!!user}
            onSignIn={() => setShowModal(true)}
          />
        </main>
      )}

      {/* ── Search view ── */}
      {view === "search" && (
        <main className="main">
          <header className="hero">
            <h1 className="hero__title">GhostIn PRO</h1>
            <p className="hero__sub">
              Stop paying for LinkedIn Recruiter. Search without limits
            </p>
          </header>

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
              AI Strategist ✨{" "}
              {!isPro && <span className="mode-toggle__pro-tag">PRO</span>}
            </button>
          </div>

          {/* Presets */}
          <section className="presets">
            <p className="presets__label">
              Quick Templates{" "}
              {!isPro && (
                <span className="presets__hint">→ fills Classic Search</span>
              )}
            </p>
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

          {isLimited && (
            <div className="limit-banner">
              <div className="limit-banner__body">
                <strong>
                  Free limit reached ({FREE_LIMIT}/{FREE_LIMIT})
                </strong>
                <p>Upgrade to PRO for unlimited searches and AI Strategist.</p>
              </div>
              <button
                className="btn btn--upgrade btn--sm"
                onClick={() => setView("pricing")}
              >
                Upgrade to PRO 🚀
              </button>
            </div>
          )}

          {/* Forms Section */}
          {!isSmartMode ? (
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              {!user && <AnonCounter count={anonCount} />}
              <form className="search-form" onSubmit={handleClassicSubmit}>
                {isLimited && (
                  <div className="search-form__paywall">
                    🔒 Daily limit reached.{" "}
                    <button
                      type="button"
                      className="search-form__paywall-link"
                      onClick={() => setView("pricing")}
                    >
                      Upgrade to PRO →
                    </button>
                  </div>
                )}
                <input
                  className="field"
                  type="text"
                  placeholder="Job Title"
                  value={formData.job_title}
                  disabled={isLimited || isAnonLimited}
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
                  disabled={isLimited || isAnonLimited}
                  onChange={(e) =>
                    setFormData({ ...formData, company: e.target.value })
                  }
                />
                <input
                  className="field"
                  type="text"
                  placeholder="Location (optional)"
                  value={formData.location}
                  disabled={isLimited || isAnonLimited}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
                <button
                  type="submit"
                  className={`btn btn--full${
                    isLimited || isAnonLimited
                      ? " btn--locked"
                      : " btn--primary"
                  }`}
                  disabled={loading || isLimited || isAnonLimited}
                >
                  {isAnonLimited
                    ? "🔒 Limit Reached — Sign Up Free"
                    : isLimited
                    ? "🔒 Limit Reached"
                    : loading
                    ? "Thinking…"
                    : "Generate Search URL"}
                </button>
              </form>
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              {/* AI Strategist */}
              {!user && <AnonCounter count={anonCount} />}
              <form
                className="search-form search-form--ai"
                onSubmit={handleAiSubmit}
              >
                {!isPro && (
                  <div className="search-form__paywall">
                    ✨ AI Strategist is a{" "}
                    <button
                      type="button"
                      className="search-form__paywall-link"
                      onClick={() => setView("pricing")}
                    >
                      GhostIn PRO
                    </button>{" "}
                    feature. Upgrade to unlock.
                  </div>
                )}
                <input
                  className="field"
                  type="text"
                  placeholder="e.g. Find senior recruiters at FAANG companies in NYC"
                  value={aiPrompt}
                  disabled={!isPro || isLimited || isAnonLimited}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onClick={!isPro ? () => setView("pricing") : undefined}
                  required={isPro}
                />
                <button
                  type={isPro ? "submit" : "button"}
                  className={`btn btn--full${
                    !isPro || isLimited || isAnonLimited
                      ? " btn--locked"
                      : " btn--primary"
                  }`}
                  disabled={loading || isLimited || isAnonLimited}
                  onClick={!isPro ? () => setView("pricing") : undefined}
                >
                  {!isPro
                    ? "🔒 PRO only — Upgrade to unlock"
                    : isAnonLimited
                    ? "🔒 Limit Reached — Sign Up Free"
                    : isLimited
                    ? "🔒 Upgrade to Unlock"
                    : loading
                    ? "Thinking…"
                    : "Ask AI Strategist ✨"}
                </button>
              </form>
            </div>
          )}

          {/* Result Area */}
          <div className="result-area">
            {loading && (
              <span className="result-area__pulse">
                {isFirstSearch
                  ? "Server is waking up... this might take a minute ☕️"
                  : "Crafting your dork... 🧠"}
              </span>
            )}

            {currentUrl && !loading && (
              <div className="result-card">
                <div className="result-card__header">
                  <code className="result-card__code">{currentRawQuery}</code>
                </div>
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

          {history.length >= 3 && !user && (
            <div className="upgrade-banner">
              <p>
                <strong>Sign in</strong> to track your search history and access
                more features.
              </p>
              <button
                className="btn btn--primary btn--sm"
                onClick={() => setShowModal(true)}
              >
                Sign In Free
              </button>
            </div>
          )}

          {/* History section */}
          {history.length > 0 && (
            <section className="history">
              <div className="history__head">
                <span className="history__label">Recent Searches</span>
                <div className="history__actions">
                  <button
                    className={`btn btn--sm${
                      isPro ? " btn--success" : " btn--locked"
                    }`}
                    onClick={handleExport}
                    title={
                      isPro ? "Export to CSV" : "CSV Export is a PRO feature"
                    }
                  >
                    {isPro ? "Export CSV ↓" : "🔒 Export CSV"}
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
                {history.slice(0, 6).map((item, i) => (
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
              {history.length > 6 && (
                <button
                  className="btn btn--outline btn--sm history__see-all"
                  onClick={() => setShowHistory(true)}
                >
                  See All ({history.length})
                </button>
              )}
            </section>
          )}
        </main>
      )}
    </div>
  );
};

export default App;
