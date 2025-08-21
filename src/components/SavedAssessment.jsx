// src/components/SavedAssessment.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";

import "./SavedAssessment.css";

export default function SavedAssessment() {
  const { session_id } = useParams();
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);

  // log whenever session_id changes
  useEffect(() => {
    console.log("🚀 SavedAssessment mounted with session_id=", session_id);
  }, [session_id]);

  // re-fetch whenever session_id changes
  useEffect(() => {
    if (!session_id) return;

    // reset state to show loading…
    setLoading(true);
    setAssessment(null);

    fetch(`http://localhost:5000/skill-assessments/${session_id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setAssessment(data);
      })
      .catch((err) => {
        console.error("Failed to load saved assessment:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [session_id]);

  if (loading) return <p>Loading assessment...</p>;
  if (!assessment) return <p>No assessment found.</p>;

  const { interest, scores, recommendations } = assessment;

  return (
    <div className="saved-assessment-container">
      <h2>Saved Skill Assessment</h2>
      <p><strong>Interest Area:</strong> {interest}</p>

      <div className="score-section">
        <h3>Skill Scores</h3>
        <ul>
          <li><strong>Technical:</strong> {scores.technical.toFixed(2)}</li>
          <li><strong>Hard Skills:</strong> {scores.hard.toFixed(2)}</li>
          <li><strong>Soft Skills:</strong> {scores.soft.toFixed(2)}</li>
        </ul>
      </div>

      <div className="recommendation-section">
        <h3>Recommendations</h3>
        {recommendations.map((rec, i) => (
          <ReactMarkdown
            key={i}
            components={{
              p: ({ node, ...props }) => <p className="recommendation-paragraph" {...props} />
            }}
          >
            {rec}
          </ReactMarkdown>
        ))}
      </div>
    </div>
  );
}
