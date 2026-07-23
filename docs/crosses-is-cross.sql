UPDATE crosses
SET is_cross = 0
WHERE is_cross IS NULL;

ALTER TABLE crosses
    MODIFY COLUMN is_cross TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE crosses
    ADD INDEX idx_crosses_is_cross (is_cross);

-- Stored procedures actualizados para recibir el nuevo parametro al final:
-- sp_cross_insert_ignore(..., p_completed_at, p_is_cross)
-- sp_cross_update_from_mcleod(..., p_completed_at, p_is_cross)
--
-- En ambos SP, guardar p_is_cross en crosses.is_cross.
