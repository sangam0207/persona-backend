const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();
const app = express();

app.use(cors({ origin: "*" }));
app.use(bodyParser.json());

const PORT = process.env.PORT || 8000;

const LLM_URL =
  "https://personanode.stagingapps.xyz/api/v1/chat/chat-completion/8690397b-8c18-482d-956f-6be40fac1a61";
const API_KEY = process.env.API_KEY;

console.log("Using API Key:", API_KEY);

app.post("/v1/chat/completions", async (req, res) => {
  try {
    const { model = "gpt-3.5-turbo", messages = [], stream = false } = req.body;

    const userInput = messages.length
      ? messages[messages.length - 1].content
      : req.body.prompt || "";

    const mappedMessages = messages.map((m) => ({
      role:
        m.role === "user" ? "human" : m.role === "assistant" ? "ai" : m.role,
      content: m.content,
    }));

    const payload = {
      input: userInput,
      context: true,
      messages: mappedMessages,
      wordLimit: 200,
      modelName: "gpt-3.5-turbo",
      language: "english",
      stream: false,
    };

    const headers = { "x-api-key": API_KEY };

    const response = await axios.post(LLM_URL, payload, { headers });
    const data = response.data;
    console.log("LLM response:", data);

    const outputText = data.content || data.output || JSON.stringify(data);

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const id = uuidv4();
      const modelName = model;

      const tokens = outputText.split(" ");

      tokens.forEach((tok) => {
        const chunk = {
          id,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: modelName,
          choices: [
            {
              index: 0,
              delta: { content: tok + " " },
              finish_reason: null,
            },
          ],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      });

      const endChunk = {
        id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: modelName,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: "stop",
          },
        ],
      };
      res.write(`data: ${JSON.stringify(endChunk)}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    } else {
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
              content: outputText,
            },
            finish_reason: "stop",
          },
        ],
      });
    }
  } catch (err) {
    console.error("Wrapper error:", err.response?.data || err.message);
    res.status(500).json({ error: "Wrapper error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Wrapper running at http://localhost:${PORT}`);
});
