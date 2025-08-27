const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();
const app = express();

// allow all origins (or restrict to your frontend domain)
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());

const PORT = process.env.PORT || 8000;

// === Your LLM service details ===
const LLM_URL = "https://personanode.stagingapps.xyz/api/v1/chat/chat-completion/8690397b-8c18-482d-956f-6be40fac1a61"; 
// hard-coded personalityId (replace with your real one if needed)
const API_KEY = process.env.API_KEY;
console.log("Using API Key:", API_KEY)
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const { model = "gpt-3.5-turbo", messages = [], stream = false } = req.body;

    // Extract user input (last user message)
    const userInput = messages.length
      ? messages[messages.length - 1].content
      : req.body.prompt || "";

    // Convert OpenAI/Tavus request into your LLM schema
    const payload = {
      input: userInput,
      context: true,
      messages: messages.map(m => ({
        role: m.role === "user" ? "human" : m.role,
        content: m.content
      })),
      wordLimit: 200,
      modelName: model,
      language: "english",
      stream
    };

    const headers = { "x-api-key": API_KEY };

    // Call your LLM service
    const response = await axios.post(LLM_URL, payload, { headers });
    const data = response.data;

    // Extract assistant response text
    const outputText = data.content || data.output || JSON.stringify(data);

    // Send back in OpenAI-compatible format
    res.json({
      id: uuidv4(),
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: outputText
          },
          finish_reason: "stop"
        }
      ]
    });

  } catch (err) {
    console.error("Wrapper error:", err.response?.data || err.message);
    res.status(500).json({ error: "Wrapper error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Wrapper running at http://localhost:${PORT}`);
});
