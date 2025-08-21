import React from "react";
import ReactMarkdown from "react-markdown";

export default function ChatWindow({ messages, loading }) {
  const fmt = (t) =>
    t.replace(/#/g, "").replace(/\n{2,}/g, "\n").trim();

  return (
    <div style={{ padding: "1rem" }}>
      {messages.map((m, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: m.sender === "user" ? "flex-end" : "flex-start",
            margin: "0.5rem 0",
          }}
        >
          <div
            style={{
              background: m.sender === "user" ? "#007bff" : "#333",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: "12px",
              maxWidth: "80%",
              whiteSpace: "pre-wrap",
            }}
          >
            <strong>{m.sender === "user" ? "You:" : "Bot:"}</strong>{" "}
            {m.sender === "bot" ? (
              <ReactMarkdown>{fmt(m.text)}</ReactMarkdown>
            ) : (
              m.text
            )}
          </div>
        </div>
      ))}
      {loading && (
        <div style={{ fontStyle: "italic", color: "#888" }}>Loading…</div>
      )}
    </div>
  );
}
