import 'dotenv/config';
import express from 'express';
import { streamAgent } from './src/agent.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Chat endpoint — streams SSE back to the client
app.post('/api/chat', async (req, res) => {
  const { messages, model } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  await streamAgent(messages, res, model);
  res.end();
});

app.listen(PORT, () => {
  console.log(`ICPC Coach Agent running at http://localhost:${PORT}`);
});
