// src/components/InputBar.jsx
import React, { useState } from "react";

export default function InputBar({ onSend }) {
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <div
      style={{
        display: "flex",
        borderTop: "1px solid #333",
        padding: "0.5rem",
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={{
          flex: 1,
          padding: "8px",
          border: "none",
          background: "#222",
          color: "#fff",
        }}
        placeholder="Ask me anything about career…"
      />
      <button
        onClick={submit}
        style={{
          marginLeft: "0.5rem",
          padding: "8px 12px",
          background: "#1e88e5",
          color: "#fff",
          border: "none",
          cursor: "pointer",
        }}
      >
        Send
      </button>
    </div>
  );
}

// src/components/ChatHistory.css
