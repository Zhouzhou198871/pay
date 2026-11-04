-- Merchant support tickets, persistent chat messages and API access approval.
ALTER TABLE pay_merchants ADD COLUMN api_access_granted INTEGER NOT NULL DEFAULT 0 CHECK (api_access_granted IN (0,1));

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '商户客服咨询',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','closed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (merchant_id) REFERENCES pay_merchants(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_updated ON support_tickets(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_updated ON support_tickets(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_id TEXT NOT NULL,
  sender_user_id TEXT,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('merchant','admin','system')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','permission_request','approval_result')),
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE RESTRICT,
  FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_ticket_created ON chat_messages(ticket_id, created_at ASC);
