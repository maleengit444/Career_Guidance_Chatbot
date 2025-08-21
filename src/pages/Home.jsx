import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // ✅ STEP 1
import ChatWindow from "../components/ChatWindow";
import InputBar from "../components/InputBar";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); // ✅ STEP 2

  const handleSend = async (text) => {
    setMessages((m) => [...m, { text, sender: "user" }]);
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json(); // ✅ STEP 3
      const { response, session_id } = data; // ✅ Get session_id
      setMessages((m) => [...m, { text: response, sender: "bot" }]);

      // ✅ STEP 4: Navigate to chat-history with this session
      if (session_id) {
        navigate(`/chat-history/${session_id}`);
      }
    } catch {
      setMessages((m) => [...m, { text: "Error, try again.", sender: "bot" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <ChatWindow messages={messages} loading={loading} />
      </div>
      <InputBar onSend={handleSend} />
    </div>
  );
}
