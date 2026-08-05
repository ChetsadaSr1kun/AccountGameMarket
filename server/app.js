const express = require('express');
const path = require('path');

const app = express();
const port = Number(process.env.PORT) || 3000;

// Accept JSON sent from the frontend or an API testing tool.
app.use(express.json());

// Our first API endpoint. It proves that the backend is running correctly.
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'GameMarket API is running',
    timestamp: new Date().toISOString(),
  });
});

// Serve the existing frontend from the same server.
app.use(express.static(path.join(__dirname, '..')));

// Return JSON for API paths that have not been created yet.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.listen(port, () => {
  console.log(`GameMarket server is running at http://localhost:${port}`);
});
