-- ============================================================
-- Row Level Security (RLS) — FinanzasApp
-- Aplicar manualmente en Supabase SQL Editor
-- ============================================================
-- IMPORTANTE: Esta app usa autenticación propia (JWT), no Supabase Auth.
-- Por eso las políticas usan current_setting('app.current_user_id')
-- en lugar de auth.uid().
--
-- Para activar esto también hay que modificar database.py para que
-- ejecute SET app.current_user_id = <id> al inicio de cada sesión.
-- Mientras tanto, el aislamiento de datos ya está garantizado por el ORM.
-- ============================================================

-- Habilitar RLS en todas las tablas con datos de usuario
ALTER TABLE transactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_expenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_servicios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inversor_perfiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inversiones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_inversiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividendos_inversiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE promociones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_promo  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Helper: obtiene el user_id de la sesión actual (seteado por la app)
-- Devuelve NULL si no está seteado (bloquea acceso por defecto)
CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS INTEGER AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true)::INTEGER;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ── Políticas por tabla ────────────────────────────────────────────────────────

CREATE POLICY user_isolation ON transactions
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON budgets
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON goals
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON debts
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON credit_cards
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON card_expenses
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON card_payments
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON user_profiles
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON servicios
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON notificaciones
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON pagos_servicios
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON inversor_perfiles
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON inversiones
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON historico_inversiones
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON dividendos_inversiones
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON promociones
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON notificaciones_promo
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON shared_groups
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON feedbacks
    USING (user_id = current_app_user_id());

CREATE POLICY user_isolation ON password_reset_tokens
    USING (user_id = current_app_user_id());
