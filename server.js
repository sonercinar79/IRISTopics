// Minimal statik sunucu — Railway için uygun
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// web-ui klasörünü kök olarak servis et
app.use(express.static(path.join(__dirname, 'web-ui'), { index: 'index.html' }));

// Basit healthcheck
app.get('/health', (_req, res) => res.status(200).send('ok'));

app.listen(PORT, () => {
  console.log(`UI running on http://localhost:${PORT}`);
});
