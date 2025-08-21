import React, { useEffect, useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import InputBar from "./InputBar";
import "./ChatHistory.css";

export default function ChatHistory() {
  const { session_id } = useParams();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  // Create a new session if none exists
  useEffect(() => {
    if (!session_id) {
      const newId = uuidv4();
      navigate(`/chat-history/${newId}`, { replace: true });
    } else {
      loadHistory(session_id);
    }
  }, [session_id]);

  // Fetch session history from backend
  const loadHistory = (id) => {
    const userId = localStorage.getItem("user_id");
    const url = `http://localhost:5000/chat-history/${id}?user_id=${encodeURIComponent(userId)}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const msgs = data.flatMap((row, i) => [
          { key: `${i}-user`, sender: "user", text: row.user_message },
          { key: `${i}-bot`, sender: "bot", text: row.bot_response },
        ]);
        setHistory(msgs);
      })
      .catch((err) => console.error("Error fetching history:", err));
  };

  // Handle message send
  const handleSend = async (text) => {
    if (!session_id) return;
    setHistory((prev) => [...prev, { key: `${Date.now()}-user`, sender: "user", text }]);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id,
          message: text,
          user_id: localStorage.getItem("user_id"),
        }),
      });

      const data = await res.json();
      setHistory((prev) => [
        ...prev,
        { key: `${Date.now()}-bot`, sender: "bot", text: data.bot_response },
      ]);
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setLoading(false);
    }
  };

  // Scroll to bottom on history update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  return (
    <div className="chat-session-container">
      <div className="chat-history-scroll" ref={scrollRef}>
        {history.length === 0 ? (
          <p className="chat-placeholder">Start your conversation...</p>
        ) : (
          history.map((msg) => (
            <div className={`message-row ${msg.sender}`} key={msg.key}>
              <div className={`message ${msg.sender}-message`}>
                <strong>{msg.sender === "user" ? "You:" : "Bot:"}</strong>{" "}
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="message-row bot">
            <div className="message bot-message typing-indicator">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-bar">
        <InputBar onSend={handleSend} />
      </div>
    </div>
  );
}
