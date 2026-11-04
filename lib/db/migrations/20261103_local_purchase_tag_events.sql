-- Reversible schema addition for local-purchase tag history.
CREATE TABLE local_purchase_tag_events (
  id SERIAL PRIMARY KEY,
  requisition_id INTEGER NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('tagged', 'untagged')),
  changed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_by_name TEXT NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX local_purchase_tag_events_requisition_id_idx
  ON local_purchase_tag_events (requisition_id);
