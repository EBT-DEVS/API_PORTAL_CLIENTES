# Notificacion de cambio de ETA

Se compara el ETA de PC*Miler guardado en `cross_stops.eta` con el nuevo
ETA calculado para la misma parada. El correo se intenta enviar despues de
guardar correctamente el nuevo valor, solamente si ambos son fechas validas y
`Math.abs(nuevo - anterior) > 3600000`.

- Aplica a adelantos y retrasos mayores a una hora.
- Una hora exacta, cambios menores, valores vacios o invalidos y paradas nuevas
  no generan correo.
- Cada comparacion usa el ultimo valor guardado; los cambios menores no se acumulan.
- No se comparan paradas de diferente ubicacion u origen que reutilicen la misma secuencia.
- Aplica a la sincronizacion de cruces y al recalculo posterior a una salida.
- La creacion inicial de un cruce no genera esta alerta.

## Configuracion

`ETA_CHANGE_NOTIFICATION_REASON_CODE` debe contener el `code` del motivo
existente en el catalogo. Su valor predeterminado es `CHANGED_ETA` (id 4 en el
catalogo consultado durante la implementacion).
Configurar destinatarios activos por grupo de cliente para ese motivo y el canal
`EMAIL` mediante `/api/notifications/reason-recipients`.

Se reutilizan `sp_notification_reason_recipients_get`, el servicio de correo
existente y `sp_notification_dispatch_log_insert`. No requiere un cron ni una
tabla adicional. El correo muestra caja, orden, PO, parada, ambos ETAs y diferencia.

Los errores de correo no interrumpen la sincronizacion; se registra `FAILED`
cuando el servicio de correo falla y `SENT` cuando responde correctamente.
No hay reintento automatico del mismo cambio: la siguiente comparacion usa el ETA
ya actualizado. Los resultados de sincronizacion incluyen `etaNotifications`;
el recalculo posterior a salida devuelve `etaNotification`.

## Verificacion

`node --test tests/etaChangeNotification.test.js`

Las pruebas usan servicios simulados y no envian correos reales.
