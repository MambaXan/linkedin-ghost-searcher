import React, { useState, useEffect } from "react";
import "./App.scss";

interface FormData {
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

const App: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    job_title: "",
    company: "",
    location: "",
  });
  const [aiPrompt, setAiPrompt] = useState("");
  const [isSmartMode, setIsSmartMode] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [currentRawQuery, setCurrentRawQuery] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("search_history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const addToHistory = (query: string, url: string) => {
    const newHistory = [
      { query, url, date: new Date().toLocaleTimeString() },
      ...history,
    ].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem("search_history", JSON.stringify(newHistory));
  };

  const handlePresetClick = (query: string) => {
    setAiPrompt(query);
    setIsSmartMode(true);
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/ai-generate-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_input: aiPrompt }),
      });
      const data = await response.json();
      if (response.ok) {
        setCurrentUrl(data.google_url);
        setCurrentRawQuery(aiPrompt);
        addToHistory(aiPrompt, data.google_url);
      } else {
        console.error("Server error:", data.detail);
        alert("Ошибка сервера: " + (data.detail || "Неизвестная ошибка"));
      }
    } catch (error) {
      console.error("Network error:", error);
      alert("Ошибка сети. Проверьте интернет или статус сервера.");
    } finally {
      setLoading(false);
    }
  };

  const handleClassicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/generate-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data: SearchResult = await response.json();
      setCurrentUrl(data.google_url);
      setCurrentRawQuery(data.raw_query);
      addToHistory(formData.job_title, data.google_url);
    } catch (error) {
      console.error("Classic mode error:", error);
      alert("Не удалось сгенерировать URL. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (history.length === 0) return;
    try {
      const response = await fetch(`${API_BASE}/export-csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(history),
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `linkedin_leads_${new Date().toLocaleDateString()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Не удалось экспортировать файл");
    }
  };

  const switchMode = (smart: boolean) => {
    setIsSmartMode(smart);
    setCurrentUrl(null);
    setCurrentRawQuery("");
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("search_history");
  };

  return (
    <div className="app-container">
      <div className="content-wrapper">
        <header>
          <h1>Ghost Searcher PRO 👻</h1>
          <p>Bypass limits with Google Dorking</p>
        </header>

        <div className="mode-toggle">
          <button
            type="button"
            onClick={() => switchMode(false)}
            className={!isSmartMode ? "active" : ""}
          >
            Classic
          </button>
          <button
            type="button"
            onClick={() => switchMode(true)}
            className={isSmartMode ? "active" : ""}
          >
            AI Strategist ✨
          </button>
        </div>

        <div className="presets-container">
          <p className="section-label">Quick Templates:</p>
          <div className="presets-grid">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="preset-tag"
                onClick={() => handlePresetClick(p.query)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {!isSmartMode ? (
          <form onSubmit={handleClassicSubmit} className="search-form">
            <input
              type="text"
              placeholder="Job Title"
              value={formData.job_title}
              onChange={(e) =>
                setFormData({ ...formData, job_title: e.target.value })
              }
              required
            />
            <input
              type="text"
              placeholder="Company"
              value={formData.company}
              onChange={(e) =>
                setFormData({ ...formData, company: e.target.value })
              }
            />
            <input
              type="text"
              placeholder="Location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
            />
            <button type="submit" disabled={loading}>
              {loading ? "Generating..." : "Generate URL"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAiSubmit} className="search-form">
            <input
              type="text"
              placeholder="e.g. Find recruiters at Google in London"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? "Thinking..." : "Ask AI Strategist"}
            </button>
          </form>
        )}

        <div className="result-area" style={{ marginTop: "20px" }}>
          {loading && (
            <span className="thinking-text">
              Strategist is crafting your dork... 🧠
            </span>
          )}

          {currentUrl && !loading && (
            <div className="result-card">
              <code>
                {isSmartMode ? "AI-Optimized Query" : currentRawQuery}
              </code>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="open-btn"
              >
                Open Search 🚀
              </a>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="history-section">
            <div
              className="history-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h3>Recent Searches</h3>
              <button onClick={handleExport} className="export-btn">
                Download CSV ↓
              </button>
              <button onClick={clearHistory} className="clear-btn">
                Clear All
              </button>
            </div>
            <div className="history-grid">
              {history.map((item, index) => (
                <a
                  key={index}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="history-tag"
                >
                  <span className="query-text">{item.query}</span>
                  <small>{item.date}</small>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
