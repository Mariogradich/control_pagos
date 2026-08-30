-- ══════════════════════════════════════════════════════════════════
--  Sistema de Gestion de Pagos en Cuotas para Eventos
--  Esquema de base de datos (PostgreSQL)
--  Aplicar con: npm run db:init
-- ══════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS installments CASCADE;
DROP TABLE IF EXISTS registrations CASCADE;
DROP TABLE IF EXISTS events CASCADE;

/* ── Eventos ────────────────────────────────────────────────────── */
CREATE TABLE events (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(200)  NOT NULL,
  event_date  TIMESTAMPTZ   NOT NULL,                       -- fecha del evento
  base_price  NUMERIC(12,2) NOT NULL CHECK (base_price >= 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

/* ── Inscripciones (asistentes) ─────────────────────────────────── */
CREATE TABLE registrations (
  id                  SERIAL PRIMARY KEY,
  event_id            INTEGER       NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name                VARCHAR(150)  NOT NULL,
  email               VARCHAR(150)  NOT NULL,
  phone               VARCHAR(30),
  total_agreed        NUMERIC(12,2) NOT NULL CHECK (total_agreed > 0),
  registration_status VARCHAR(20)   NOT NULL DEFAULT 'pending_payment'
                      CHECK (registration_status IN ('pending_payment','partially_paid','fully_paid')),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, email)          -- evita inscribir el mismo email dos veces al evento
);

CREATE INDEX idx_registrations_event ON registrations(event_id);

/* ── Cuotas mensuales ───────────────────────────────────────────── */
CREATE TABLE installments (
  id                 SERIAL PRIMARY KEY,
  registration_id    INTEGER       NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  installment_number INTEGER       NOT NULL CHECK (installment_number >= 1),
  amount             NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  due_date           DATE          NOT NULL,
  status             VARCHAR(10)   NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','partial','paid')),
  paid_amount        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  paid_at            TIMESTAMPTZ,
  UNIQUE (registration_id, installment_number)
);

CREATE INDEX idx_installments_registration ON installments(registration_id);
