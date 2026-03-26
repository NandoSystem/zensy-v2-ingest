const express = require('express');

const app = express();
app.use(express.json({ limit: '10mb' }));

const DEFAULT_BOARD_IDS = ['12162'];
const buildSensorRegistry = () => {
  const source = process.env.KNOWN_BOARD_IDS || DEFAULT_BOARD_IDS.join(',');
  return new Set(
    source
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  );
};

const knownSensors = buildSensorRegistry();
const seenImageKeys = new Set();
const MAX_DEDUPE_ENTRIES = Number(process.env.DEDUPE_MAX_ENTRIES || 5000);

const logEvent = (classification, boardId, imageId, reason) => {
  const payload = {
    ts: new Date().toISOString(),
    classification,
    boardId: boardId || 'unknown',
    imageId: imageId || 'none',
    reason,
  };
  console.log('[ingest]', JSON.stringify(payload));
};

const sanitizeBoardId = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const extractBoardId = (body) => {
  const candidates = [body.boardid, body.boardId, body.sensorid, body.sensorId];
  for (const candidate of candidates) {
    const normalized = sanitizeBoardId(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
};

const normalizeImageId = (image) => {
  if (!image) {
    return null;
  }
  const candidate = image.ID ?? image.id;
  if (candidate === undefined || candidate === null) {
    return null;
  }
  const normalized = String(candidate).trim();
  return normalized.length > 0 ? normalized : null;
};

const isPositiveInteger = (value) => {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0;
  }
  return false;
};

const rememberImageKey = (key) => {
  if (!key) {
    return;
  }
  if (seenImageKeys.size >= MAX_DEDUPE_ENTRIES) {
    const oldest = seenImageKeys.values().next().value;
    if (oldest) {
      seenImageKeys.delete(oldest);
    }
  }
  seenImageKeys.add(key);
};

const classifyPayload = (body) => {
  if (!body || typeof body !== 'object') {
    return { classification: 'malformed', reason: 'Request body must be a JSON object' };
  }

  const boardId = extractBoardId(body);
  if (!boardId) {
    return { classification: 'malformed', reason: 'boardid is required' };
  }

  const message = body.message;
  if (!message || typeof message !== 'object') {
    return { classification: 'malformed', boardId, reason: 'message must be an object' };
  }

  const image = message.IMAGE || message.image;
  if (!image) {
    return { classification: 'non_image_message', boardId, reason: 'message contains no IMAGE payload' };
  }

  const imageId = normalizeImageId(image);
  const chunkCount = image.NUM ?? image.num;
  const dataField = image.DATA ?? image.data;

  const errors = [];
  if (!imageId) {
    errors.push('IMAGE.ID is required');
  }
  if (!isPositiveInteger(chunkCount)) {
    errors.push('IMAGE.NUM must be an integer');
  }
  if (typeof dataField !== 'string' || dataField.trim().length === 0) {
    errors.push('IMAGE.DATA must be a non-empty string');
  }

  if (errors.length > 0) {
    return {
      classification: 'malformed',
      boardId,
      imageId: imageId || undefined,
      reason: errors.join('; '),
    };
  }

  if (!knownSensors.has(boardId)) {
    return {
      classification: 'unknown_sensor',
      boardId,
      imageId,
      reason: 'boardid not in registry',
    };
  }

  const dedupeKey = `${boardId}:${imageId}`;
  if (seenImageKeys.has(dedupeKey)) {
    return {
      classification: 'duplicate',
      boardId,
      imageId,
      reason: 'IMAGE.ID already processed for this boardid',
    };
  }

  return {
    classification: 'accepted',
    boardId,
    imageId,
    reason: 'payload accepted',
    dedupeKey,
  };
};

app.post('/ingest', (req, res) => {
  const result = classifyPayload(req.body);
  logEvent(result.classification, result.boardId, result.imageId, result.reason);

  if (result.classification === 'malformed') {
    return res.status(400).json({ error: result.reason });
  }

  if (result.classification === 'accepted' && result.dedupeKey) {
    rememberImageKey(result.dedupeKey);
  }

  return res.status(204).send();
});

app.get('/', (_req, res) => {
  res.send('Zensy ingest is running');
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', sensorsTracked: knownSensors.size });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
