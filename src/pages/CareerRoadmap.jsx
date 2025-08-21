
import React from 'react';

function CareerRoadmap() {
  const sampleRoadmap = [
    "Identify your strengths and interests",
    "Choose a domain to explore (e.g., Tech, Health, Arts)",
    "Build relevant skills through free/paid courses",
    "Work on projects or volunteer to gain experience",
    "Craft a strong LinkedIn and resume",
    "Apply for internships or junior roles",
    "Keep learning and network with professionals"
  ];

  return (
    <div className="chat-window">
      <h2>Career Roadmap</h2>
      <ol>
        {sampleRoadmap.map((step, idx) => (
          <li key={idx} style={{ marginBottom: '10px' }}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

export default CareerRoadmap;
