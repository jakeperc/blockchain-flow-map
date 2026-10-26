-- The history recorder's working tables (decision D8). Raw rows, read ranges and price samples are held only until the
-- quarter hours that need them are sealed; spans are kept 8 days; only spans are ever published.

-- One run at a time.
CREATE TABLE lease (id INTEGER PRIMARY KEY CHECK (id = 1), holder TEXT NOT NULL, until INTEGER NOT NULL);

-- Per chain: where live reading started, how far it has read forward, how far the backfill has read back, and where the
-- backfill stops. A *_block is the last block read (live) or the first (back); its *_time is the block-time boundary
-- the next read continues from (readInterval's `next`).
CREATE TABLE cursor (
 chain TEXT PRIMARY KEY,
 live_since INTEGER NOT NULL,
 live_block INTEGER NOT NULL, live_time INTEGER NOT NULL,
 back_block INTEGER NOT NULL, back_time INTEGER NOT NULL,
 back_goal INTEGER NOT NULL
);

-- Block-time ranges actually read: a span's coverage.
CREATE TABLE observed (chain TEXT NOT NULL, from_ms INTEGER NOT NULL, to_ms INTEGER NOT NULL);
CREATE INDEX observed_chain ON observed (chain, to_ms);

-- Decoded transfers as recorder-core RecordRow tuples (JSON), split well under D1's 2 MB row limit.
CREATE TABLE chunks (chain TEXT NOT NULL, min_time INTEGER NOT NULL, max_time INTEGER NOT NULL, n INTEGER NOT NULL, rows TEXT NOT NULL);
CREATE INDEX chunks_chain ON chunks (chain, max_time);

-- 5-minute price samples, one series per provider.
CREATE TABLE prices (asset TEXT NOT NULL, at INTEGER NOT NULL, usd REAL NOT NULL, source TEXT NOT NULL, PRIMARY KEY (asset, at, source));

-- Sealed spans as StoredRollup JSON.
CREATE TABLE spans (chain TEXT NOT NULL, bucket INTEGER NOT NULL, sealed_at INTEGER NOT NULL, unpriced INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY (chain, bucket));

-- The day file each UTC day is published as, and whether its spans changed since.
CREATE TABLE days (day TEXT PRIMARY KEY, file TEXT, spans INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL DEFAULT 0, published_at INTEGER, dirty INTEGER NOT NULL DEFAULT 1);

-- Superseded day files, deleted from R2 once no manifest a reader may still hold names them.
CREATE TABLE retired (file TEXT PRIMARY KEY, at INTEGER NOT NULL);
