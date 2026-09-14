-- COMPROMISED is no longer part of the supported key lifecycle.
-- Preserve any legacy key material by moving those rows to the reversible
-- deactivated state, then let the startup integrity initializer re-sign them.
UPDATE crypto_key
SET status = 'DEACTIVATED',
    integrity_hash = 'PENDING_V6_SCHEMA_REALIGN'
WHERE status = 'COMPROMISED';

UPDATE key_status_history
SET from_status = 'DEACTIVATED'
WHERE from_status = 'COMPROMISED';

UPDATE key_status_history
SET to_status = 'DEACTIVATED'
WHERE to_status = 'COMPROMISED';

DELETE FROM common_code
WHERE code_group = 'STATUS'
  AND code = 'COMPROMISED';
