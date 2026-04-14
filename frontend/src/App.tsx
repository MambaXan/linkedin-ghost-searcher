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
  const [result, setResult] = useState<SearchResult | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    fetch("https://linkedin-ghost-searcher.onrender.com/templates")
      .then((res) => res.json())
      .then((data: Template[]) => setTemplates(data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch(
      "https://linkedin-ghost-searcher.onrender.com/generate-query",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      }
    );
    const data: SearchResult = await response.json();
    setResult(data);
  };

  return (
    <div className="app-container">
      <div className="content-wrapper">
        <header>
          <h1>Ghost Searcher TS 👻</h1>
          <p>Bypass limits with Google Dorking</p>
        </header>

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

        {result && (
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
