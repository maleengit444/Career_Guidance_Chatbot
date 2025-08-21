import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import mysql from "mysql2";
import { v4 as uuidv4 } from "uuid";

dotenv.config({ path: "./.env" });

const app = express();
app.use(cors());
app.use(express.json());

// Create a MySQL connection pool
const pool = mysql
  .createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "chatbot_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })
  .promise();

// Test the pool on startup
pool
  .getConnection()
  .then((conn) => {
    console.log("✅ MySQL pool connected");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ MySQL pool error:", err);
  });

// Register
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  // Check if username already exists
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
    
    if (rows.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Insert new user into the database
    await pool.query(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, password]
    );

    res.status(200).json({ message: "Registration successful!" });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});


// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE username = ? AND password = ?",
      [username, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
    res.json({ message: "Login successful", user_id: user.id });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});


// POST /chat — handle incoming message, fetch from AI, save both user & bot
app.post("/chat", async (req, res) => {
  const { message, session_id, title, user_id } = req.body;
  const sessionId = session_id || uuidv4();
  // If no title is provided, auto-generate one based on the user's first message
  let sessionTitle = title || generateTitle(message);
  console.log("Parsed user message:", message);

  try {
    // 1) Fetch full chat history for context
    const [history] = await pool.query(
      `SELECT user_message, bot_response 
       FROM chat_history 
       WHERE session_id = ? 
       ORDER BY id DESC 
       LIMIT 10`, // Last 10 exchanges
      [sessionId]
    );
    history.reverse(); // Oldest to newest

    // 2) Build the full conversation thread for the AI
    const messages = [
      {
        role: "system",
        content: `You are *Msee wa Mtaa*, a friendly Kenyan career guidance assistant.
Speak casually like a Nairobi youth – in Kenyan Swahili mixed with Sheng.
Avoid formal Tanzanian Swahili. Don't mention Tanzanian websites, policies, or schools.
Respond using Kenyan lingo, jokes, proverbs, and cultural vibes.
Only recommend resources relevant to Kenyans – like HELB, KUCCPS, JKUAT, Ajira Digital, or online hustles like transcription or YouTube.
Be inspirational: say things like "Hii life ni kujipanga", "Wewe uko na potential", or "Hustle si ya ku give up".
If a user uses formal English, switch to polite English. But if they drop Kiswahili/Sheng, match their tone kabisa.`,
      },
      {
        role: "user",
        content: "Nataka kujua career za tech"
      },
      {
        role: "assistant",
        content: "Apo freshi! Tech iko na options mob – kama software dev, data science, ama UX design. Unapenda coding ama uko kwa design side?"
      },
      ...history.flatMap((row) => [
        { role: "user", content: row.user_message },
        { role: "assistant", content: row.bot_response },
      ]),
      { role: "user", content: message }, // Latest user message
    ];

    // 3) Send to OpenRouter
    const apiRes = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1:free",
          messages,
        }),
      }
    );

    const data = await apiRes.json();
    console.log("🔍 OpenRouter raw response:", JSON.stringify(data, null, 2));

    const reply =
      data?.choices?.[0]?.message?.content ||
      "Sorry, I couldn't get a valid response.";

    console.log("Bot response:", reply);

    // 4) Save chat history
    const insertChat =
      "INSERT INTO chat_history (session_id, user_message, bot_response) VALUES (?, ?, ?)";
    await pool.query(insertChat, [sessionId, message, reply]);
    console.log(`✅ Chat history saved for session: ${sessionId}`);

    // 5) Upsert session title
      // 5) Upsert session title + owner
  const upsertTitle = `
  INSERT INTO chat_sessions (session_id, title, user_id)
  VALUES (?, ?, ?)
  ON DUPLICATE KEY UPDATE
    title = VALUES(title),
    user_id = VALUES(user_id)
`;
await pool.query(upsertTitle, [
  sessionId,
  title || "Untitled Chat",
  user_id    // ← use the destructured variable here
]);

    console.log(`✅ Session title saved for session: ${sessionId}`);

    // 6) Send response to frontend
    res.json({ response: reply, session_id: sessionId, bot_response: reply });

  } catch (err) {
    console.error("❌ Error in /chat route:", err);
    res.status(500).json({ error: "Something went wrong on the server" });
  }
});

// Helper function to generate a dynamic session title based on user message
function generateTitle(message) {
  const keywords = ["career", "tech", "job", "opportunities", "skills"];
  let title = "Untitled Chat";

  // Check if the message contains keywords to generate a dynamic title
  for (let keyword of keywords) {
    if (message.toLowerCase().includes(keyword)) {
      title = `Career Guidance on ${keyword.charAt(0).toUpperCase() + keyword.slice(1)}`;
      break;
    }
  }

  return title;
}

// GET /chat-sessions — list all sessions with titles & first message time
app.get("/chat-sessions", async (req, res) => {
  const userId = req.query.user_id;  // optional filter by user
  try {
    // Base query to fetch sessions and first message time
    let q = `
      SELECT cs.session_id, cs.title, MIN(ch.timestamp) AS first_message_time
      FROM chat_history ch
      LEFT JOIN chat_sessions cs ON ch.session_id = cs.session_id
    `;
    const params = [];

    // If a user_id is provided, filter sessions by that user
    if (userId) {
      q += ` WHERE cs.user_id = ? `;
      params.push(userId);
    }

    // Complete the query with grouping and ordering
    q += `
      GROUP BY cs.session_id
      ORDER BY first_message_time DESC
    `;

    const [rows] = await pool.query(q, params);
    res.json(rows);
  } catch (err) {
    console.error("❌ Failed to fetch sessions:", err);
    res.status(500).json({ error: "Error fetching sessions" });
  }
});

// GET /chat-history/:session_id — fetch one session’s messages
app.get("/chat-history/:session_id", async (req, res) => {
  const { session_id } = req.params;
  const userId = req.query.user_id;  // read user_id

  // 1) Verify session ownership
  const [[sessionRow]] = await pool.query(
    "SELECT user_id FROM chat_sessions WHERE session_id = ?",
    [session_id]
  );
  if (!sessionRow || String(sessionRow.user_id) !== String(userId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // 2) Load history if owner
  const q = `
    SELECT ch.*, cs.title
    FROM chat_history ch
    LEFT JOIN chat_sessions cs ON ch.session_id = cs.session_id
    WHERE ch.session_id = ?
    ORDER BY ch.timestamp ASC
  `;
  const [rows] = await pool.query(q, [session_id]);
  res.json(rows);
});



// GET /skills?interest=… with dynamic AI fallback and suggestions
app.get("/skills", async (req, res) => {
  const interest = (req.query.interest || "").trim().toLowerCase();

  // 1) static bank, now with question+suggestions objects
  const bank = {
    technology: {
      technicalSkills: [
        {
          question: "Describe your proficiency with JavaScript frameworks.",
          suggestions: [
            "I build SPAs with React",
            "I’ve used Vue for small projects",
            "I’m new to frameworks"
          ]
        },
        {
          question: "How do you approach debugging complex code?",
          suggestions: [
            "I use console logs + breakpoints",
            "I write unit tests to isolate bugs",
            "I ask a peer to pair-program"
          ]
        },
        {
          question: "Explain your familiarity with RESTful APIs.",
          suggestions: [
            "I design and consume them in Node.js",
            "I’ve used Postman to test endpoints",
            "I haven’t worked with APIs yet"
          ]
        },
      ],
      hardSkills: [
        {
          question: "Explain your knowledge of data structures & algorithms.",
          suggestions: [
            "I’ve implemented linked lists and trees",
            "I know sorting/search algorithms",
            "I need more practice"
          ]
        },
        {
          question: "How do you write and run unit tests?",
          suggestions: [
            "I use Jest for JS testing",
            "I write tests before features (TDD)",
            "I rarely write tests"
          ]
        },
        {
          question: "Describe your experience with Git version control.",
          suggestions: [
            "I use feature branching daily",
            "I commit small changes often",
            "I’m new to Git"
          ]
        },
      ],
      softSkills: [
        {
          question: "How do you communicate complex technical ideas?",
          suggestions: [
            "I use diagrams and examples",
            "I explain step-by-step verbally",
            "I struggle with that"
          ]
        },
        {
          question: "Describe a time you collaborated on a team project.",
          suggestions: [
            "I led a capstone project",
            "I contributed via code reviews",
            "I prefer working solo"
          ]
        },
        {
          question: "How do you handle stressful deadlines?",
          suggestions: [
            "I break tasks into milestones",
            "I reprioritize and ask for help",
            "I work overtime if needed"
          ]
        },
      ]
    },

    hospitality: {
      technicalSkills: [
        {
          question: "How familiar are you with POS systems?",
          suggestions: [
            "I’ve used Toast POS",
            "I’ve trained but not used live",
            "No experience"
          ]
        },
        {
          question: "Describe your experience with booking software.",
          suggestions: [
            "I managed reservations in OpenTable",
            "I used manual booking logs",
            "Never used any"
          ]
        },
        {
          question: "Explain your understanding of inventory control.",
          suggestions: [
            "I conduct weekly stocktakes",
            "I use real-time inventory tools",
            "No exposure"
          ]
        },
      ],
      hardSkills: [
        {
          question: "How do you handle guest complaints?",
          suggestions: [
            "Listen actively and apologize",
            "Offer immediate solutions",
            "Escalate to manager"
          ]
        },
        {
          question: "Describe your event-planning experience.",
          suggestions: [
            "Planned hotel weddings",
            "Assisted with corporate banquets",
            "None"
          ]
        },
        {
          question: "How do you coordinate multiple vendors?",
          suggestions: [
            "Maintain schedules and contacts",
            "Weekly check-in calls",
            "Never done this"
          ]
        },
      ],
      softSkills: [
        {
          question: "How do you communicate with guests?",
          suggestions: [
            "Warm and friendly tone",
            "Professional and concise",
            "I struggle under pressure"
          ]
        },
        {
          question: "Describe teamwork in a busy shift.",
          suggestions: [
            "We rotate tasks dynamically",
            "We assist each other proactively",
            "Prefer slower pace"
          ]
        },
        {
          question: "How do you manage stress on a rush day?",
          suggestions: [
            "Deep breaths and prioritize",
            "Focus on one task at a time",
            "It’s very challenging"
          ]
        },
      ]
    },

    // … add more categories as needed …
  };

  if (bank[interest]) {
    return res.json(bank[interest]);
  }

  // 2) dynamic AI fallback
  try {
    console.log(`Interest '${interest}' not in bank; generating via AI…`);

    const aiRes = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1:free",
          messages: [
            {
              role: "system",
              content:
                "You are a JSON generator. When asked, you output ONLY valid JSON—no explanation, no markdown.",
            },
            {
              role: "user",
              content: `Generate three technicalSkills questions, three hardSkills questions, and three softSkills questions for a skill assessment in the field of "${interest}". Each question should be an object with keys "question" (open-ended) and "suggestions" (2–4 sample answers). Output only valid JSON.`,
            },
          ],
        }),
      }
    );

    const aiData = await aiRes.json();
    let txt = aiData.choices?.[0]?.message?.content || "";
    txt = txt.replace(/```json|```/g, "").trim();

    const parsed = JSON.parse(txt);
    console.log("AI-generated questions:", parsed);

    return res.json({
      technicalSkills: parsed.technicalSkills || [],
      hardSkills: parsed.hardSkills || [],
      softSkills: parsed.softSkills || [],
    });
  } catch (err) {
    console.error("❌ AI fallback failed:", err);
    return res.json({
      technicalSkills: [{ question: `No technical questions available for "${interest}".`, suggestions: [] }],
      hardSkills:      [{ question: `No hard-skill questions available for "${interest}".`, suggestions: [] }],
      softSkills:      [{ question: `No soft-skill questions available for "${interest}".`, suggestions: [] }],
    });
  }
});


// ... the code you already have above (imports, pool, /chat, /chat-sessions, /chat-history, /skills) …

// NEW: POST /evaluate-skills — analyze user’s answers and return personalized recommendations
app.post("/evaluate-skills", async (req, res) => {
  const { interest, answers } = req.body;

  // answers is an object like { "technical-0": "…", "hard-1": "…", … }
  // Group them back into categories:
  const techAnswers = [];
  const hardAnswers = [];
  const softAnswers = [];
  Object.entries(answers).forEach(([key, ans]) => {
    const [cat, idx] = key.split("-");
    if (cat === "technical") techAnswers.push(ans);
    if (cat === "hard")      hardAnswers.push(ans);
    if (cat === "soft")      softAnswers.push(ans);
  });

  // Build the enhanced prompt
  const prompt = `
You are a friendly, engaging career-guidance expert (think ChatGPT style).  

The user’s area of interest is: "${interest}".  

They answered these questions:  
• Technical Skills answers: ${techAnswers.join(" | ")}  
• Hard Skills answers: ${hardAnswers.join(" | ")}  
• Soft Skills answers: ${softAnswers.join(" | ")}  

Please:
1. Summarize their key strengths and areas to improve.
2. Recommend 2–3 specific career paths or roles tailored to their interest and skill profile.
3. For each area they could improve, suggest concrete learning resources—mention at least one YouTube channel, one online course or platform, and one relevant certification or community.
4. Keep your tone upbeat, encouraging, and conversational, as if you’re personally coaching them.

Respond in clear paragraphs; no lists of JSON—just human-readable advice.
`;

  try {
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1:free",
        messages: [
          { role: "system", content: "You are a helpful career guidance assistant." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await aiRes.json();
    const reply = data?.choices?.[0]?.message?.content ||
                  "Sorry, I couldn't generate recommendations right now.";

    console.log("✅ /evaluate-skills AI reply:", reply);
    res.json({ recommendations: reply });
  } catch (err) {
    console.error("❌ Error in /evaluate-skills:", err);
    res.status(500).json({ error: "Failed to evaluate skills." });
  }
});

// GET /skill-assessments/:session_id — retrieve saved skill assessment for a specific session
app.get("/skill-assessments/:session_id", async (req, res) => {
  const { session_id } = req.params;

  try {
    const q = `
      SELECT * FROM skill_assessments
      WHERE session_id = ?
    `;
    const [rows] = await pool.query(q, [session_id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "No assessment found for this session." });
    }

    const assessment = rows[0];
    // Return the assessment in the response
    res.json({
      session_id: assessment.session_id,
      interest: assessment.interest,
      answers: JSON.parse(assessment.answers),
      scores: JSON.parse(assessment.scores),
      recommendations: assessment.recommendations.split("\n\n"), // Split recommendations if it's stored as text
    });
  } catch (err) {
    console.error("❌ Failed to fetch skill assessment:", err);
    res.status(500).json({ error: "Failed to fetch skill assessment" });
  }
});


// POST /save-assessment — save skill assessment tied to a session_id
app.post("/save-assessment", async (req, res) => {
  let { session_id, interest, answers, scores, recommendations } = req.body;

  if (!session_id) {
    session_id = uuidv4();
    console.log("🔵 Generated new session_id for skill assessment:", session_id);
  }

  // ── NEW: ensure the session exists in chat_sessions so the FK constraint passes
  try {
    const upsertSession = `
      INSERT INTO chat_sessions (session_id, title)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE title = title
    `;
    await pool.query(upsertSession, [session_id, `Assessment: ${interest}`]);
    console.log(`✅ Ensured session in chat_sessions: ${session_id}`);
  } catch (upErr) {
    console.error("❌ Could not upsert chat_sessions:", upErr);
    // (we continue anyway)
  }

  try {
    const sql = `
      INSERT INTO skill_assessments
        (session_id, interest, answers, scores, recommendations)
      VALUES (?, ?, ?, ?, ?)
    `;
    await pool.query(sql, [
      session_id,
      interest,
      JSON.stringify(answers),
      JSON.stringify(scores),
      Array.isArray(recommendations)
        ? recommendations.join("\n\n")
        : recommendations,
    ]);

    console.log(`✅ Skill assessment saved for session: ${session_id}`);
    return res.json({ message: "Assessment saved" });
  } catch (err) {
    console.error("❌ Error saving assessment:", err);
    return res.status(500).json({ error: "Failed to save assessment" });
  }
});




// ───── NEW ROUTE ─────
// GET /skill-assessments  → return every saved assessment
app.get("/skill-assessments", async (_req, res) => {
  
  try {
    const q = `
      SELECT * 
      FROM skill_assessments
      ORDER BY created_at DESC
    `;
    const [rows] = await pool.query(q);
    const formatted = rows.map(r => ({
      session_id:     r.session_id,
      interest:       r.interest,
      answers:        JSON.parse(r.answers),
      scores:         JSON.parse(r.scores),
      recommendations: r.recommendations.split("\n\n"),
      created_at:     r.created_at
    }));
    res.json(formatted);
  } catch (err) {
    console.error("❌ Failed to fetch all skill assessments:", err);
    res.status(500).json({ error: "Failed to fetch all skill assessments" });
  }
});

// … your existing GET /skill-assessments (list all) above …

// GET a single saved assessment by session_id
app.get("/skill-assessments/:session_id", async (req, res) => {
  const { session_id } = req.params;
  try {
    const q = `
      SELECT *
      FROM skill_assessments
      WHERE session_id = ?
      LIMIT 1
    `;
    const [rows] = await pool.query(q, [session_id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "No assessment found for this session." });
    }

    const a = rows[0];
    res.json({
      session_id:     a.session_id,
      interest:       a.interest,
      answers:        JSON.parse(a.answers),
      scores:         JSON.parse(a.scores),
      recommendations: a.recommendations.split("\n\n"),
      created_at:     a.created_at
    });
  } catch (err) {
    console.error("❌ Failed to fetch single skill assessment:", err);
    res.status(500).json({ error: "Failed to fetch skill assessment" });
  }
});


app.listen(5000, () => {
  console.log("🚀 Server running at http://localhost:5000");
});
