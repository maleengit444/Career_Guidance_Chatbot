import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import "./Sidebar.css";

export default function Sidebar() {
  const [sessions, setSessions] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const loc = useLocation().pathname;
  const navigate = useNavigate();

  // fetch chat sessions, filtered by logged-in user
  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    let url = "http://localhost:5000/chat-sessions";
    if (userId) {
      url += `?user_id=${encodeURIComponent(userId)}`;
    }

    fetch(url)
      .then((res) => {
        console.log("HTTP /chat-sessions status:", res.status);
        return res.json();
      })
      .then((data) => {
        console.log("Fetched sessions for user", userId, data);
        setSessions(data);
      })
      .catch((err) =>
        console.error("Error fetching chat sessions:", err)
      );
  }, []);

  // fetch saved skill assessments
  useEffect(() => {
    fetch("http://localhost:5000/skill-assessments")
      .then((res) => {
        console.log("HTTP /skill-assessments status:", res.status);
        return res.json();
      })
      .then((data) => {
        console.log("Fetched assessments:", data);
        setAssessments(data);
      })
      .catch((err) =>
        console.error("Error fetching assessments:", err)
      );
  }, []);

  const handleNewChat = () => {
    const newSessionId = uuidv4();
    const userId = localStorage.getItem("user_id");

    fetch("http://localhost:5000/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: newSessionId, user_id: userId }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to create session");
        return res.json();
      })
      .then(() => {
        navigate(`/chat-history/${newSessionId}`);
      })
      .catch((err) => {
        console.error("Error creating session:", err);
        navigate(`/chat-history/${newSessionId}`); // fallback
      });
  };

  return (
    <div className="sidebar">
      <h2>CareerBot</h2>
      <button
        className={loc === "/" ? "active" : ""}
        onClick={handleNewChat}
      >
        New Chat
      </button>
      <Link to={`/skill-assessment`}>
        <button className={loc.startsWith("/skill-assessment") ? "active" : ""}>
          Skill Assessment
        </button>
      </Link>
      <Link to="/roadmap">
        <button className={loc === "/roadmap" ? "active" : ""}>
          Career Roadmap
        </button>
      </Link>

      <h3 style={{ marginTop: "2rem" }}>Previous Chats</h3>
      <ul>
        {sessions.length === 0 && (
          <li style={{ color: "#888" }}>No previous chats.</li>
        )}
        {sessions.map((s, i) => (
          <li key={`${s.session_id}-${i}`}>
            <Link
              to={`/chat-history/${s.session_id}`}
              style={{ textDecoration: "none" }}
            >
              <div className="session-item">
                <span className="session-title">
                  {s.title || s.session_id}
                </span>
                <span className="session-time">
                  {new Date(s.first_message_time).toLocaleString()}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <h3 style={{ marginTop: "2rem" }}>Saved Assessments</h3>
      <ul>
        {assessments.length === 0 && (
          <li style={{ color: "#888" }}>No saved assessments.</li>
        )}
        {assessments.map((a, i) => (
          <li key={`${a.session_id}-${i}`}>
            <Link
              to={`/saved-assessment/${a.session_id}`}
              style={{ textDecoration: "none" }}
            >
              <div className="session-item">
                <span className="session-title">
                  {a.interest || a.session_id}
                </span>
                <span className="session-time">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
