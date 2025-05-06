-- Create enums
CREATE TYPE token_status AS ENUM ('ACTIVE', 'PENDING', 'FAILED');
CREATE TYPE transaction_type AS ENUM ('CREATION', 'TRANSFER', 'MARKET_CREATION');
CREATE TYPE transaction_status AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  tokens_created INTEGER DEFAULT 0 NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE NOT NULL
);

-- Create tokens table
CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  mint_address TEXT UNIQUE NOT NULL,
  creator_wallet TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  total_supply BIGINT NOT NULL,
  decimals INTEGER NOT NULL,
  open_book_market TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  status token_status DEFAULT 'ACTIVE' NOT NULL,
  metadata_uri TEXT NOT NULL,
  FOREIGN KEY (creator_wallet) REFERENCES users(wallet_address)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  token_id TEXT NOT NULL,
  type transaction_type NOT NULL,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT,
  amount BIGINT,
  tx_signature TEXT NOT NULL,
  status transaction_status DEFAULT 'PENDING' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  error TEXT,
  FOREIGN KEY (token_id) REFERENCES tokens(id),
  FOREIGN KEY (from_wallet) REFERENCES users(wallet_address)
); 