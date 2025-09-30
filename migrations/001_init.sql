-- players
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- games
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host_email TEXT,
  status TEXT NOT NULL, -- waiting | in_progress | finished
  max_players INTEGER,
  turn_length_hours INTEGER,
  retreat_length_hours INTEGER,
  random_assignment INTEGER,
  players TEXT,         -- JSON array of {email,country,is_host,joined_at}
  current_turn INTEGER DEFAULT 1,
  current_phase TEXT DEFAULT 'spring', -- spring | fall | retreat | winter
  game_state TEXT,       -- JSON: units, retreats_required, etc.
  phase_deadline TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);

-- moves
CREATE TABLE IF NOT EXISTS game_moves (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  email TEXT,
  country TEXT,
  turn_number INTEGER,
  phase TEXT,
  source_phase TEXT,
  orders TEXT,          -- JSON
  submitted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_moves_game ON game_moves(game_id);

-- chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  thread_id TEXT,
  message TEXT,
  sender_email TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_game ON chat_messages(game_id);
