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

interface Template {
  id: number;
  title: string;
  text: string;
}

const App: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    job_title: "",
    company: "",
    location: "",
  });
  const [aiPrompt, setAiPrompt] = useState("");
  const [isSmartMode, setIsSmartMode] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);

  const API_BASE = "https://linkedin-ghost-searcher.onrender.com";

  useEffect(() => {
    fetch(`${API_BASE}/templates`)
      .then((res) => res.json())
      .then((data: Template[]) => setTemplates(data))
      .catch((err) => console.error("Fetch error:", err));
  }, []);

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(
        "https://linkedin-ghost-searcher.onrender.com/ai-generate-query",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_input: aiPrompt }),
        }
      );
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch(`${API_BASE}/generate-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const data: SearchResult = await response.json();
    setResult(data);
  };

  return (
    <div className="app-container">
      <div className="content-wrapper">
        <header>
          <h1>Ghost Searcher TS 👻</h1>
          <p>Bypass limits with Google Dorking</p>

          <div className="mode-toggle">
            <button
              type="button"
              onClick={() => {
                setIsSmartMode(false);
                setResult(null);
              }}
              className={!isSmartMode ? "active" : ""}
            >
              Classic
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSmartMode(true);
                setResult(null);
              }}
              className={isSmartMode ? "active" : ""}
            >
              AI Strategist ✨
            </button>
          </div>
        </header>

        {!isSmartMode ? (
          <form onSubmit={handleSubmit} className="search-form">
            <input
              type="text"
              placeholder="Job Title"
              onChange={(e) =>
                setFormData({ ...formData, job_title: e.target.value })
              }
              required
            />
            <input
              type="text"
              placeholder="Company"
              onChange={(e) =>
                setFormData({ ...formData, company: e.target.value })
              }
            />
            <input
              type="text"
              placeholder="Location"
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
            />
            <button type="submit">Generate URL</button>
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

        {result && result.raw_query && (
          <div className="result-card">
            <code>{result.raw_query}</code>
            <a
              href={result.google_url}
              target="_blank"
              rel="noreferrer"
              className="open-btn"
            >
              Open Search 🚀
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
