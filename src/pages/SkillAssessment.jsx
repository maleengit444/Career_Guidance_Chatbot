// src/pages/SkillAssessment.jsx
import React, { useState } from "react";
import { useParams } from "react-router-dom";

import "./SkillAssessment.css";
import ReactMarkdown from "react-markdown"; // ← Add at the top
import { v4 as uuidv4 } from "uuid"; // ← Add this to import uuid

export default function SkillAssessment() {

  const { session_id } = useParams();
  const [interest, setInterest] = useState("");
  const [questions, setQuestions] = useState({ soft: [], hard: [], technical: [] });
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(1);
  const [scores, setScores] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false); // ← loading flag
  const [assessmentId, setAssessmentId] = useState(""); // ← New state

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:5000/skills?interest=${encodeURIComponent(interest)}`
      );
      const data = await res.json();
      console.log("Fetched data:", data);
      setQuestions({
        
        soft: data.softSkills,
        hard: data.hardSkills,
        technical: data.technicalSkills,
      });
      setAssessmentId(uuidv4()); // ← Generate fresh ID after loading questions
      setStep(2);
    } catch (err) {
      console.error("Failed to fetch questions:", err);
      alert("Could not load questions. Try again.");
    }
    setLoading(false); // ← Always stop loading at the end
    const data = await res.json();
    console.log("Fetched data:", data); // ← ADD THIS LINE
    setQuestions({
      soft: data.softSkills,
      hard: data.hardSkills,
      technical: data.technicalSkills,
});

  };
  //handle submit
  const handleSubmit = async () => {
    const cats = ["technical", "hard", "soft"];
    const newScores = {};
    cats.forEach((cat) => {
      const qs = questions[cat];
      const sum = qs.reduce(
        (acc, _, i) => acc + (answers[`${cat}-${i}`] ? 1 : 0),
        0
      );
      newScores[cat] = qs.length ? sum / qs.length : 0;
    });
    setScores(newScores);

    setLoading(true); // ← start animation
    try {
      const res = await fetch("http://localhost:5000/evaluate-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interest, answers }),
      });
      const data = await res.json();
      const paras = data.recommendations
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p);
      setRecommendations(paras);

      // ✅ SAVE TO BACKEND after getting recommendations
      await fetch("http://localhost:5000/save-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id,
          assessment_id: assessmentId, // ← Added to save new ID                 // this must be accessible
          interest,
          answers,
          scores: newScores,
          recommendations: paras,
        }),
      });
      console.log("✅ Skill assessment saved to backend");
    } catch (err) {
      console.error("AI evaluation failed:", err);
      const fallbackRecs = [];
      if (newScores.technical >= 0.8) fallbackRecs.push("Consider advanced technical roles like Senior Developer.");
      else if (newScores.technical >= 0.5) fallbackRecs.push("Build up technical skills with online courses.");
      else fallbackRecs.push("Start with fundamentals workshops.");
      setRecommendations(fallbackRecs);
    }
    setLoading(false); // ← end animation
    setStep(3);
  };
  

  const renderCategory = (catKey, label) => (
    <div className="sa-category">
      <h3>{label}</h3>
      {questions[catKey].map((qObj, i) => {
        const key = `${catKey}-${i}`;
        return (
          <div className="sa-question" key={key}>
            <p className="sa-question-text">{qObj.question}</p>

            {qObj.suggestions?.length > 0 && (
              <select
                className="sa-select"
                value={answers[key] || ""}
                onChange={(e) =>
                  setAnswers((a) => ({ ...a, [key]: e.target.value }))
                }
              >
                <option value="">Select a suggested answer</option>
                {qObj.suggestions.map((s, idx) => (
                  <option key={idx} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            <textarea
              className="sa-textarea"
              placeholder="Or type your own answer..."
              value={answers[key] || ""}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [key]: e.target.value }))
              }
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="skill-assessment">
      {step === 1 && (
        <div className="sa-step">
          <h2>Skill Assessment</h2>
          <p>Enter the area you’re most interested in:</p>
          <input
            className="sa-input"
            type="text"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && interest.trim()) {
                e.preventDefault();
                fetchQuestions();
              }
            }}
            placeholder="e.g. Technology"
          />
          <button
          className="sa-button"
          onClick={async () => {
            setLoading(true);
            await fetchQuestions();
            setLoading(false);
          }}
          disabled={!interest.trim() || loading}
        >
          {loading ? (
            <span className="bouncing-emoji">🚀 Loading...</span>
          ) : (
            "Next: Load Questions"
          )}
        </button>

        </div>
      )}

      {step === 2 && (
        <div className="sa-step">
          <h2>Answer the Questions</h2>
          {renderCategory("technical", "Technical Skills")}
          {renderCategory("hard", "Hard Skills")}
          {renderCategory("soft", "Soft Skills")}
          <button className="sa-button" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="loading-dots">Fetching Results<span>.</span><span>.</span><span>.</span></span> : "Submit Assessment"}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="sa-step">
          <h2>Your Results</h2>
          <div className="sa-scores">
            <p><strong>Technical:</strong> {scores.technical.toFixed(2)}</p>
            <p><strong>Hard Skills:</strong> {scores.hard.toFixed(2)}</p>
            <p><strong>Soft Skills:</strong> {scores.soft.toFixed(2)}</p>
          </div>
          <h3>Recommendations</h3>
          <div className="sa-recs">
          {recommendations.map((r, i) => (
            <div key={i} className="sa-rec-para">
              <ReactMarkdown>{r}</ReactMarkdown>
            </div>
          ))}
        </div>
                    <button className="sa-button" onClick={() => setStep(1)}>
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}
