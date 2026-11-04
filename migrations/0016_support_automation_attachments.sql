-- Support automation, compliance acceptance, D1-backed private attachments and scalable pagination.
-- Extend the message roles/types while preserving existing conversations.
CREATE TABLE chat_messages_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_id TEXT NOT NULL,
  sender_user_id TEXT,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('merchant','admin','ai','system')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','permission_request','approval_result','attachment')),
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE RESTRICT,
  FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE RESTRICT
);
INSERT INTO chat_messages_v2 (id,ticket_id,sender_user_id,sender_role,message_type,content,metadata_json,created_at)
SELECT id,ticket_id,sender_user_id,sender_role,message_type,content,metadata_json,created_at FROM chat_messages;
DROP TABLE chat_messages;
ALTER TABLE chat_messages_v2 RENAME TO chat_messages;
CREATE INDEX IF NOT EXISTS idx_chat_messages_ticket_created_id ON chat_messages(ticket_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_created ON chat_messages(sender_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_requests_ticket_created ON api_access_requests(ticket_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_requests_merchant_created ON api_access_requests(merchant_id,created_at DESC,id DESC);
ALTER TABLE api_access_requests ADD COLUMN compliance_accepted_at INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS support_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  ticket_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  uploader_user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  data_base64 TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(ticket_id) REFERENCES support_tickets(id) ON DELETE RESTRICT,
  FOREIGN KEY(message_id) REFERENCES chat_messages(id) ON DELETE RESTRICT,
  FOREIGN KEY(uploader_user_id) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_support_attachments_ticket_created ON support_attachments(ticket_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_support_attachments_message ON support_attachments(message_id);

CREATE TABLE IF NOT EXISTS support_admin_presence (
  admin_user_id TEXT PRIMARY KEY NOT NULL,
  last_seen_at INTEGER NOT NULL,
  FOREIGN KEY(admin_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_support_admin_presence_seen ON support_admin_presence(last_seen_at DESC);
