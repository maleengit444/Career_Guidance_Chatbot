// src/components/QuestionForm.jsx
import React from "react";

const QuestionForm = ({ questions, answers, onAnswerChange }) => {
  return (
    <div className="space-y-4">
      {questions.map((q, index) => (
        <div key={index} className="bg-white p-4 rounded shadow">
          <p className="font-semibold">{q.question}</p>
          {q.options.map((option, i) => (
            <label key={i} className="block">
              <input
                type="radio"
                name={`question-${index}`}
                value={option}
                checked={answers[index] === option}
                onChange={() => onAnswerChange(index, option)}
                className="mr-2"
              />
              {option}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
};

export default QuestionForm;
