// ============================================================
// server.js — Simple backend server for your AI assistant
// ============================================================
//
// WHY do we need a server?
// The Anthropic API doesn't allow calls directly from a browser
// because of a security rule called CORS. So we use this tiny
// Node.js server as the "middleman":
//   Browser → this server → Anthropic API → back to browser
//
// HOW TO RUN:
//   1. Open a terminal in this folder
//   2. Run:  node server.js
//   3. Open your browser to:  http://localhost:3000
// ============================================================

// ------------------------------------------------------------------
// 1. SETUP — Load built-in Node.js tools (no installs needed!)
// ------------------------------------------------------------------
const http = require('http');  // Built-in: lets us create a web server
const fs   = require('fs');    // Built-in: lets us read files
const path = require('path');  // Built-in: helps with file paths

// ------------------------------------------------------------------
// 2. YOUR API KEY — Put your Anthropic API key here
// ------------------------------------------------------------------
// Get your free key at: https://console.anthropic.com/
//
// SAFETY TIP: Never share this file or push it to GitHub with your
// real key inside. For a real project, use environment variables.
// For now, just paste your key below:
//
const API_KEY = process.env.ANTHROPIC_API_KEY || 'YOUR_API_KEY_HERE';
//
// To use an environment variable instead (safer!), run the server like:
//   set ANTHROPIC_API_KEY=sk-ant-... && node server.js   (Windows)
//   ANTHROPIC_API_KEY=sk-ant-... node server.js          (Mac/Linux)

// ------------------------------------------------------------------
// 3. THE AI'S PERSONALITY — This is the "system prompt"
// ------------------------------------------------------------------
// This tells the AI who it is before the conversation starts.
// Think of it as the AI's character sheet!
const SYSTEM_PROMPT = `You are a brilliant AI assistant with a unique personality blend:

🎉 Friendly & Casual: You talk like a smart friend, not a robot. Use everyday language,
   contractions, and occasional humor. Never be stiff or overly formal.

🧠 Smart & Professional: You give accurate, well-reasoned answers. You back up facts,
   explain complex topics clearly, and admit when you're unsure rather than guessing.

🎮 Fun & Playful: You enjoy witty jokes, fun analogies, and keeping things light.
   If someone seems stressed, you help them relax with a bit of humor.

You love helping with:
- Coding: explaining, writing, and debugging code in any language
- Teaching: breaking down tricky topics into simple, clear explanations
- Creative projects: games, stories, apps, websites — anything goes!
- Everyday questions: you're like a brilliant friend who knows everything

Always aim to be the most helpful, genuine, and enjoyable AI they've ever talked to. ✨`;

// ------------------------------------------------------------------
// 4. THE SERVER — This handles all incoming requests
// ------------------------------------------------------------------
const PORT = 3000;

const server = http.createServer(async (req, res) => {

  // --- CORS headers: allow the browser to talk to this server ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle "preflight" requests (browsers send these before POST requests)
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ----------------------------------------------------------------
  // ROUTE 1: Serve the main HTML page
  //   When someone visits http://localhost:3000, send them index.html
  // ----------------------------------------------------------------
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const filePath = path.join(__dirname, 'index.html');

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('index.html not found. Make sure it is in the same folder as server.js!');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });

    return;
  }

  // ----------------------------------------------------------------
  // ROUTE 2: Handle chat messages
  //   When the browser POSTs to /chat, forward it to the Anthropic API
  // ----------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/chat') {

    // Collect the incoming message data from the browser
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', async () => {
      try {
        // Parse the JSON that the browser sent us
        const { messages } = JSON.parse(body);

        // Make sure we actually got some messages
        if (!messages || !Array.isArray(messages)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No messages provided' }));
          return;
        }

        // Check if the API key is still the placeholder
        if (API_KEY === 'YOUR_API_KEY_HERE') {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Please add your Anthropic API key in server.js! Look for the line that says YOUR_API_KEY_HERE'
          }));
          return;
        }

        // -----------------------------------------------------------
        // Call the Anthropic API
        // We use Node's built-in fetch (available in Node 18+)
        // -----------------------------------------------------------
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,                    // Your secret key
            'anthropic-version': '2023-06-01'         // Required API version header
          },
          body: JSON.stringify({
            model: 'claude-opus-4-8',     // The AI model to use (most capable)
            max_tokens: 16000,            // Maximum length of the AI's reply
            system: SYSTEM_PROMPT,        // The personality we defined above
            messages: messages,           // The full conversation history
            thinking: { type: 'adaptive' } // Let the model think deeply when needed
          })
        });

        // If something went wrong on Anthropic's end, tell the browser
        if (!anthropicResponse.ok) {
          const errorText = await anthropicResponse.text();
          console.error('Anthropic API error:', errorText);
          res.writeHead(anthropicResponse.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `API error: ${anthropicResponse.status}` }));
          return;
        }

        // Get the AI's response
        const data = await anthropicResponse.json();

        // Send it back to the browser
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));

      } catch (error) {
        // Something unexpected went wrong — log it and tell the browser
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Something went wrong on the server. Check your terminal for details.' }));
      }
    });

    return;
  }

  // ----------------------------------------------------------------
  // ROUTE 3: Anything else → 404
  // ----------------------------------------------------------------
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// Start listening for requests
server.listen(PORT, () => {
  console.log('');
  console.log('  ✅ AI Assistant server is running!');
  console.log('');
  console.log(`  👉 Open your browser to: http://localhost:${PORT}`);
  console.log('');
  console.log('  Press Ctrl+C to stop the server');
  console.log('');
});
