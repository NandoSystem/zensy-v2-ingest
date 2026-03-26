const express = require('express');
const app = express();

app.use(express.json({ limit: '10mb' }));

app.post('/ingest', (req, res) => {
  console.log('Incoming payload:', JSON.stringify(req.body, null, 2));

  // TODO: her skal vi senere lagre til S3 / DB
  // Foreløpig bare bekrefter vi mottak

  res.status(204).send();
});

app.get('/', (req, res) => {
  res.send('Zensy ingest is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
