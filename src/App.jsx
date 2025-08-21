import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import SkillAssessment from "./pages/SkillAssessment";      // ← your new page
import CareerRoadmap from "./pages/CareerRoadmap";
import ChatHistory from "./components/ChatHistory.jsx";
import SavedAssessment from "./components/SavedAssessment";
import Login from "./components/Login"; // Adjust the path if necessary
import Register from "./components/Register"; // Adjust the path if necessary

import "./index.css";

function App() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/chat-sessions")
      .then((res) => res.json())
      .then((data) => {
        console.log("Loaded sessions:", data);
        setSessions(data);
      })
      .catch((err) => console.error("Failed loading sessions:", err));
  }, []);

  return (
    <Router>
      <div style={{ display: "flex", height: "100vh" }}>
        <Sidebar sessions={sessions} />

        <div style={{ flex: 1, overflowY: "auto" }}>
          <Routes>
            
            <Route path="/skill-assessment" element={<SkillAssessment />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />  {/* Add Register route */}
            <Route path="/skill-assessment/:session_id" element={<SkillAssessment />} />   {/* updated */}
            <Route path="/roadmap" element={<CareerRoadmap />} />
            <Route path="/chat-history/:session_id" element={<ChatHistory />} />
            <Route path="/saved-assessment/:session_id" element={<SavedAssessment />} />  {/* ← ADD THIS */}
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
