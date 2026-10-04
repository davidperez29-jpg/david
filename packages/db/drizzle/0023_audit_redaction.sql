-- Phase 13 (RGPD art. 17): the audit trail stays append-only, with one narrow exception. When a
-- client is erased (anonymized), the field values in the diffs and the free-text reasons of that
-- client's audit entries are redacted. Who did what and when (action, entity, actor, time) stays.
CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND current_setting('app.audit_redaction', true) = 'on'
     AND NEW.id = OLD.id
     AND NEW.occurred_at = OLD.occurred_at
     AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id
     AND NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id
     AND NEW.actor_roles IS NOT DISTINCT FROM OLD.actor_roles
     AND NEW.action = OLD.action
     AND NEW.entity_type = OLD.entity_type
     AND NEW.entity_id IS NOT DISTINCT FROM OLD.entity_id
     AND NEW.client_id IS NOT DISTINCT FROM OLD.client_id
     AND NEW.request_id IS NOT DISTINCT FROM OLD.request_id
     AND NEW.ip_hash IS NOT DISTINCT FROM OLD.ip_hash THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_logs is append-only (% not allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- Callable by the application only as ADMIN of the client's organization (or by system code
-- without an actor, e.g. the retention job).
CREATE OR REPLACE FUNCTION redact_client_audit(p_client uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer;
  c_org uuid;
BEGIN
  SELECT organization_id INTO c_org FROM clients WHERE id = p_client;
  IF c_org IS NULL THEN RAISE EXCEPTION 'client not found'; END IF;
  IF app_user_id() IS NOT NULL AND NOT (app_has_role('ADMIN') AND app_org_id() = c_org) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  PERFORM set_config('app.audit_redaction', 'on', true);
  UPDATE audit_logs
     SET changes = CASE WHEN changes IS NULL THEN NULL ELSE '"[suprimido: derecho de supresión]"'::jsonb END,
         reason = CASE WHEN reason IS NULL THEN NULL ELSE '[suprimido]' END
   WHERE client_id = p_client AND (changes IS NOT NULL OR reason IS NOT NULL);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('app.audit_redaction', 'off', true);
  RETURN n;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION redact_client_audit(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION redact_client_audit(uuid) TO app_runtime;
