CREATE DEFINER=`sysebtapps_prd_admin_portal`@`%` PROCEDURE `sp_cross_get_active_data`(
    IN p_customer_code VARCHAR(50),
    IN p_customer_group_id INT,
    IN p_is_cross TINYINT,
    IN p_trailer_id VARCHAR(50),
    IN p_start DATE,
    IN p_end DATE,
    IN p_po_number VARCHAR(50)
)
BEGIN
    DECLARE v_customer_group_id INT DEFAULT NULL;

    IF p_customer_group_id IS NOT NULL THEN
        SET v_customer_group_id = p_customer_group_id;
    ELSEIF p_customer_code IS NOT NULL AND TRIM(p_customer_code) <> '' THEN
        SELECT cgc.customer_group_id
        INTO v_customer_group_id
        FROM customer_group_customers cgc
        WHERE cgc.mcleod_customer_code = TRIM(p_customer_code)
          AND cgc.is_active = 1
        LIMIT 1;
    END IF;

    SELECT DISTINCT
        c.id,
        c.is_cross,
        c.cross_status_id,
        c.trailer_id AS caja,
        c.mcleod_order_id,
        c.po_number,
        s.name AS order_status,
        s.color_hex
    FROM crosses c
    INNER JOIN cat_cross_statuses s
        ON s.id = c.cross_status_id
    WHERE c.trailer_id IS NOT NULL
      AND c.cross_status_id <> 13
      AND c.trailer_id <> ''
      AND (
          p_is_cross IS NULL
          OR (p_is_cross IN (0, 1) AND c.is_cross = p_is_cross)
          OR (p_is_cross = 2 AND c.is_cross = 1)
      )
      AND (
          (
              (p_trailer_id IS NULL OR TRIM(p_trailer_id) = '')
              AND (p_po_number IS NULL OR TRIM(p_po_number) = '')
          )
          OR (
              p_trailer_id IS NOT NULL
              AND TRIM(p_trailer_id) <> ''
              AND c.trailer_id LIKE CONCAT('%', TRIM(p_trailer_id), '%')
          )
          OR (
              p_po_number IS NOT NULL
              AND TRIM(p_po_number) <> ''
              AND c.po_number LIKE CONCAT('%', TRIM(p_po_number), '%')
          )
      )
      AND (
          v_customer_group_id IS NULL
          OR c.customer_group_id = v_customer_group_id
      )
      AND (
          ((p_start IS NULL AND p_end IS NULL) AND (p_is_cross IS NULL OR p_is_cross <> 2))
          OR (
              p_is_cross = 1
              AND (
                  EXISTS (
                      SELECT 1
                      FROM cross_stops first_customs
                      INNER JOIN cross_stops prev
                          ON prev.cross_id = first_customs.cross_id
                         AND prev.sequence = first_customs.sequence - 1
                      WHERE first_customs.cross_id = c.id
                        AND first_customs.stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
                        AND first_customs.sequence = (
                            SELECT MIN(customs.sequence)
                            FROM cross_stops customs
                            WHERE customs.cross_id = c.id
                              AND customs.stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
                        )
                        AND prev.sched_arrive IS NOT NULL
                        AND (p_start IS NULL OR prev.sched_arrive >= p_start)
                        AND (p_end IS NULL OR prev.sched_arrive < DATE_ADD(p_end, INTERVAL 1 DAY))
                  )
                  OR EXISTS (
                      SELECT 1
                      FROM cross_stops last_customs
                      INNER JOIN cross_stops next_stop
                          ON next_stop.cross_id = last_customs.cross_id
                         AND next_stop.sequence = last_customs.sequence + 1
                      WHERE last_customs.cross_id = c.id
                        AND last_customs.stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
                        AND last_customs.sequence = (
                            SELECT MAX(customs.sequence)
                            FROM cross_stops customs
                            WHERE customs.cross_id = c.id
                              AND customs.stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
                        )
                        AND next_stop.sched_arrive IS NOT NULL
                        AND (p_start IS NULL OR next_stop.sched_arrive >= p_start)
                        AND (p_end IS NULL OR next_stop.sched_arrive < DATE_ADD(p_end, INTERVAL 1 DAY))
                  )
              )
          )
          OR (
              p_is_cross = 2
              AND EXISTS (
                  SELECT 1
                  FROM cross_stops last_customs
                  INNER JOIN cross_stops next_stop
                      ON next_stop.cross_id = last_customs.cross_id
                     AND next_stop.sequence = last_customs.sequence + 1
                  WHERE last_customs.cross_id = c.id
                    AND last_customs.stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
                    AND last_customs.sequence = (
                        SELECT MAX(customs.sequence)
                        FROM cross_stops customs
                        WHERE customs.cross_id = c.id
                          AND customs.stop_code IN ('MX_CUSTOMS', 'US_CUSTOMS')
                    )
                    AND next_stop.actual_arrival IS NOT NULL
                    AND (p_start IS NULL OR next_stop.actual_arrival >= p_start)
                    AND (p_end IS NULL OR next_stop.actual_arrival < DATE_ADD(p_end, INTERVAL 1 DAY))
              )
          )
          OR (
              (p_is_cross IS NULL OR p_is_cross = 0)
              AND EXISTS (
                  SELECT 1
                  FROM cross_stops cs
                  WHERE cs.cross_id = c.id
                    AND cs.sched_arrive IS NOT NULL
                    AND (p_start IS NULL OR cs.sched_arrive >= p_start)
                    AND (p_end IS NULL OR cs.sched_arrive < DATE_ADD(p_end, INTERVAL 1 DAY))
              )
          )
      )
    ORDER BY c.trailer_id;
END
