// const express = require("express");
// const axios = require("axios");
// const bodyParser = require("body-parser");
// const { v4: uuidv4 } = require("uuid");
// const dotenv = require("dotenv");
// dotenv.config();
// const app = express();
// app.use(bodyParser.json());

// const PORT = process.env.PORT || 8000;

// // === Your LLM service details ===
// const LLM_URL = "https://personanode.stagingapps.xyz/api/v1/chat/chat-completion/8690397b-8c18-482d-956f-6be40fac1a61"; 
// // hard-coded personalityId (replace with your real one if needed)
// const API_KEY = process.env.API_KEY;
// console.log("Using API Key:", API_KEY)
// app.post("/v1/chat/completions", async (req, res) => {
//   try {
//     const { model = "gpt-3.5-turbo", messages = [], stream = false } = req.body;

//     // Extract user input (last user message)
//     const userInput = messages.length
//       ? messages[messages.length - 1].content
//       : req.body.prompt || "";

//     // Convert OpenAI/Tavus request into your LLM schema
//     const payload = {
//       input: userInput,
//       context: true,
//       messages: messages.map(m => ({
//         role: m.role === "user" ? "human" : m.role,
//         content: m.content
//       })),
//       wordLimit: 200,
//       modelName: model,
//       language: "english",
//       stream
//     };

//     const headers = { "x-api-key": API_KEY };

//     // Call your LLM service
//     const response = await axios.post(LLM_URL, payload, { headers });
//     const data = response.data;

//     // Extract assistant response text
//     const outputText = data.content || data.output || JSON.stringify(data);

//     // Send back in OpenAI-compatible format
//     res.json({
//       id: uuidv4(),
//       object: "chat.completion",
//       created: Math.floor(Date.now() / 1000),
//       model,
//       choices: [
//         {
//           index: 0,
//           message: {
//             role: "assistant",
//             content: outputText
//           },
//           finish_reason: "stop"
//         }
//       ]
//     });

//   } catch (err) {
//     console.error("Wrapper error:", err.response?.data || err.message);
//     res.status(500).json({ error: "Wrapper error", details: err.message });
//   }
// });

// app.listen(PORT, () => {
//   console.log(`Wrapper running at http://localhost:${PORT}`);
// });
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 8000;

// === Your LLM service details ===
const LLM_URL = "https://personanode.stagingapps.xyz/api/v1/chat/chat-completion/8690397b-8c18-482d-956f-6be40fac1a61";
const API_KEY = process.env.API_KEY;

console.log("Using API Key:", API_KEY);

// OpenAI-compatible endpoint
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const { model = "gpt-3.5-turbo", messages = [], stream = false } = req.body;

    // Last user input
    const userInput = messages.length
      ? messages[messages.length - 1].content
      : req.body.prompt || "";

    // Map roles for your backend
    const mappedMessages = messages.map(m => ({
      role: m.role === "user" ? "human" : m.role === "assistant" ? "ai" : m.role,
      content: m.content
    }));

    // Payload for your LLM
    const payload = {
      input: userInput,
      context: true,
      messages: mappedMessages,
      wordLimit: 200,
      modelName: model,
      language: "english",
      stream: false // Your backend doesn’t support SSE, so we simulate it here
    };

    const headers = { "x-api-key": API_KEY };

    // Call your LLM service (non-streaming)
    const response = await axios.post(LLM_URL, payload, { headers });
    const data = response.data;

    // Extract text
    const outputText =
      data.content ||
      data.output ||
      data.message ||
      (data.choices && data.choices[0]?.message?.content) ||
      JSON.stringify(data);

    if (stream) {
      // --- STREAMING MODE ---
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const id = uuidv4();
      const modelName = model;

      // Split into words or chunks
      const tokens = outputText.split(" ");

      tokens.forEach((tok, i) => {
        const chunk = {
          id,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: modelName,
          choices: [
            {
              index: 0,
              delta: { content: tok + " " }, // add space back
              finish_reason: null
            }
          ]
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      });

      // End with [DONE]
      res.write(`data: [DONE]\n\n`);
      res.end();

    } else {
      // --- NON-STREAMING MODE ---
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
    }

  } catch (err) {
    console.error("Wrapper error:", err.response?.data || err.message);
    res.status(500).json({ error: "Wrapper error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Wrapper with SSE running at http://localhost:${PORT}`);
});
