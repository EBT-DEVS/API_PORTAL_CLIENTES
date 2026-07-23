# Flujo nuevo de cruces (`crosses`)

Este documento describe el flujo actual de cruces. El proceso viejo de carpetas `crossings` queda reemplazado por el flujo nuevo basado en `crosses`.

## Tablas Base

```text
crosses
cross_stops
cross_assignments
cross_customs
cat_cross_statuses
cat_cross_priorities
customer_groups
customer_group_customers
customer_group_cross_plants
```

## Objetivo Actual

El proceso inicializa cruces desde McLeod y persiste la informacion en DB.

```text
1. Leer plantas activas del catalogo de grupos.
2. Leer clientes activos del catalogo de grupos.
3. Consultar ordenes McLeod por planta y fecha/rango.
4. Filtrar ordenes por clientes activos.
5. Construir stops reales.
6. Hidratar stops faltantes desde McLeod.
7. Compactar stops reales consecutivos repetidos.
8. Insertar stops virtuales de Aduana MX y Aduana US.
9. Resolver assignments por cache DB o por McLeod.
10. Construir payload de crosses.
11. Calcular status desde stops.
12. Persistir crosses, stops y assignments por SP idempotente.
```

## Carpeteo Actual

```text
src/cron
  index.js
  crosses.cron.js

src/jobs/crosses
  cross.job.js
  crossesInit.job.js

src/services/crosses
  crossesSync.service.js
  crossesMcleodOrders.service.js
  crossesOrdersFilter.service.js
  crossesStopsPayload.service.js
  crossesAssignmentsPayload.service.js
  crossesPayload.service.js
  crossesInit.service.js
  crossesInitPersistence.service.js

src/models/crosses
  crosses.model.js
  crosses.stops.model.js
  crosses.assignments.model.js
  crosses.customs.model.js
  crosses.cat.statuses.model.js
  crosses.cat.priorities.model.js

src/controllers/crosses
  crosses.controller.js

src/routes/crosses
  crosses.routes.js

src/catalogs/crosses
  virtual-cross-stops.json

scripts
  run-crosses-init-by-date.js
```

## Cron

Archivo:

```text
src/cron/crosses.cron.js
```

Schedule:

```text
*/20 * * * *
```

Cada 20 minutos ejecuta:

```js
runCrossesInitJob({
  company,
  lookbackHours,
})
```

No manda `dateString`, por lo que usa el rango automatico: ayer a seis dias despues de hoy.

El cron se inicializa desde:

```text
src/server.js
  -> src/cron/index.js
    -> src/cron/crosses.cron.js
```

Arranque normal:

```powershell
npm run dev
```

o:

```powershell
npm start
```

## Script Manual Por Fecha

Archivo:

```text
scripts/run-crosses-init-by-date.js
```

Comando npm:

```powershell
npm run cron:crosses-date -- --date-string=2026-07-09
```

Comando directo:

```powershell
node scripts\run-crosses-init-by-date.js --date-string=2026-07-09
```

Opciones:

```text
--date-string=YYYY-MM-DD      requerido
--company=ebt                 opcional
--is-active=1                 opcional
--priority-id=2               opcional
--refetchAssignments=true     opcional
```

## Consulta De Ordenes McLeod

Archivo:

```text
src/services/crosses/crossesMcleodOrders.service.js
```

Query base:

```text
shipper.location_id={plant_location_code}
shipper.sched_arrive_early={dateFilter}
```

Si se manda `dateString`:

```text
input: 2026-07-09
McLeod: 07/09/26
```

Si no se manda `dateString`, usa:

```text
hoy - 1 dia : hoy + 6 dias
```

Ejemplo: si hoy es 07/17/26, McLeod recibe 07/16/26:07/23/26.

Endpoint:

```text
/orders/search?{query}
```

## Filtro Por Clientes

Archivo:

```text
src/services/crosses/crossesOrdersFilter.service.js
```

Compara:

```text
order.customer_id
```

contra:

```text
customer_group_customers.mcleod_customer_code
```

## Stops

Archivo:

```text
src/services/crosses/crossesStopsPayload.service.js
```

Para cada orden:

```text
1. Leer movements.
2. Tomar origin_stop_id y dest_stop_id.
3. Validar que ambos existan en order.stops.
4. Hidratar faltantes con /stops/{stopId}.
5. Construir payload de cross_stops.
6. Compactar stops reales consecutivos repetidos.
7. Insertar stops virtuales de Aduana MX y Aduana US.
```

### Compactacion De Stops Repetidos

Si hay stops reales consecutivos con el mismo `stop_code`, se deja uno solo.

Reglas:

```text
actual_arrival = actual_arrival del primer stop repetido
actual_departure = actual_departure del ultimo stop repetido
sequence = se recalcula despues de compactar
```

Los `_mcleod_stop_id` compactados se conservan internamente para que los assignments puedan resolver `origin_stop_id` y `destination_stop_id` al `cross_stop.id` final.

### Stops Virtuales

Catalogo:

```text
src/catalogs/crosses/virtual-cross-stops.json
```

Contiene:

```text
MX_CUSTOMS
US_CUSTOMS
```

Regla:

```text
MX_CUSTOMS y US_CUSTOMS se insertan justo antes del primer stop real cuyo state sea TX, solo si antes de ese TX existe al menos un stop con state que no sea un codigo estatal de USA.
Si el primer stop real ya tiene state TX, o si todos los stops antes del primer TX son de USA, no se insertan stops virtuales de aduana.
```

Campos virtuales:

```text
source = SYSTEM
actual_arrival = null
actual_departure = null
is_completed = 0
_is_virtual = true
```

## Assignments

Archivo:

```text
src/services/crosses/crossesAssignmentsPayload.service.js
```

Para cada movement:

```text
1. Leer equipment_group_id.
2. Leer movement.id como move_id.
3. Si refetchAssignments = false, buscar primero en DB.
4. Si no hay cache o refetchAssignments = true, consultar McLeod.
5. Mapear trailer, tractor y drivers.
```

SP cache:

```text
sp_cross_assignment_get_by_equipment_or_move(p_equipment_group_id, p_move_id)
```

Endpoint McLeod:

```text
/equipment_item/search?equipment_group_id={equipmentGroupId}
```

Mapeo:

```text
equipment_type_id = L -> trailer_id
equipment_type_id = T -> tractor_id
equipment_type_id = D -> driver_1_id / driver_2_id
```

## Payload De Cross

Archivo:

```text
src/services/crosses/crossesPayload.service.js
```

Reglas principales:

```text
priority_id = 2
started_at = actual_arrival del primer stop
completed_at = actual_departure del ultimo stop
is_cross = 1 si tiene stop de aduana MX_CUSTOMS o US_CUSTOMS, si no 0
```

Resolucion de trailer:

```text
1. order.preload_trailer_id
2. movement.carrier_trailer
3. assignments.trailer_id
```

Campos base:

```js
{
  customer_group_id,
  cross_status_id,
  priority_id,
  mcleod_order_id,
  mcleod_customer_id,
  trailer_id,
  min_temperature,
  max_temperature,
  started_at,
  completed_at,
  is_cross
}
```

## Persistencia

Archivo:

```text
src/services/crosses/crossesInitPersistence.service.js
```

Orden:

```text
1. sp_cross_insert_ignore
2. sp_cross_stop_insert_ignore
3. Resolver cross_stop.id para origin/destination.
4. sp_cross_assignment_insert_ignore
```

Los SP son idempotentes. Si el registro ya existe, el flujo lo reutiliza.

## Stored Procedures

Lectura/catalogos:

```text
sp_customer_group_cross_plants_get(p_is_active)
sp_customer_group_customers_get(p_is_active)
sp_cat_cross_statuses_get(p_code)
sp_cross_assignment_get_by_equipment_or_move(p_equipment_group_id, p_move_id)
```

Inicializacion:

```text
sp_cross_insert_ignore(...)
sp_cross_stop_insert_ignore(...)
sp_cross_assignment_insert_ignore(...)
```

Consulta API:

```text
sp_cross_get_active_data()
sp_cross_get_detail_by_id(p_cross_id)
```

Actualizacion API:

```text
sp__cross_customs_upsert(
  p_cross_stop_id,
  p_customs_country,
  p_light,
  p_papers_ready,
  p_comments
)

sp_cross_stop_update_times(
  p_cross_stop_id,
  p_actual_arrival,
  p_actual_departure
)
```

GPS:

```text
sysebtapps_prd_gps_data.sp_ebt_trailer_positions_get(trailer)
```

## API

Base:

```text
/api
```

Rutas:

```text
POST /api/login
GET  /api/crosses/active/trailers
GET  /api/crosses/:crossId
PUT  /api/crosses/stops/:crossStopId/customs
```

### Login

Ruta:

```text
POST /api/login
```

Controller:

```text
src/controllers/login/login.controller.js
```

Valida el token externo, firma token local con:

```text
src/config/tokens/token.config.js
```

`signToken` usa:

```js
jwt.sign(payload, API_SECRET, { expiresIn: API_EXPIRATION })
```

### Cruces Activos

Ruta:

```text
GET /api/crosses/active/trailers
```

SP:

```text
sp_cross_get_active_data()
```

Regresa cajas activas que no esten en status `COMPLETED` o `CANCELED`.

### Detalle De Cruce

Ruta:

```text
GET /api/crosses/:crossId
```

SP:

```text
sp_cross_get_detail_by_id(p_cross_id)
```

Respuesta agrupada:

```js
{
  cross,
  stops,
  equipment,
  gps
}
```

### Upsert De Customs Y Tiempos De Stop

Ruta:

```text
PUT /api/crosses/stops/:crossStopId/customs
```

Siempre llama:

```text
sp__cross_customs_upsert
```

Solo llama:

```text
sp_cross_stop_update_times
```

cuando `actual_arrival` o `actual_departure` trae algun valor.

Body aceptado:

```json
{
  "customs_country": "MX",
  "light": "GREEN",
  "papers_ready": 1,
  "comments": "Papeles listos",
  "actual_arrival": "2026-07-09 10:30:00",
  "actual_departure": null
}
```

Tambien acepta camelCase:

```json
{
  "customsCountry": "US",
  "papersReady": true,
  "actualArrival": null,
  "actualDeparture": "2026-07-09 11:15:00"
}
```

## Status

El status del cross se calcula desde `cross_stops` ordenados por `sequence`.

Reglas:

```text
COMPLETED                  ultimo stop tiene actual_departure
AVAILABLE                  primer stop no tiene actual_arrival
IN_PLANT                   primer stop tiene arrival pero no departure
IN_TRANSIT_TO_BORDER       origen salio y MX_CUSTOMS no ha llegado
AT_MX_CUSTOMS              MX_CUSTOMS llego y no salio
CROSSING                   MX_CUSTOMS salio y US_CUSTOMS no ha llegado
AT_US_CUSTOMS              US_CUSTOMS llego y no salio
IN_TRANSIT_TO_US_YARD      US_CUSTOMS salio y primer TX no ha llegado
AT_US_YARD                 primer TX llego y no salio, si no es ultimo stop
IN_TRANSIT_TO_CUSTOMER     ya paso US yard/customs y ultimo stop no ha salido
```

Status finales actuales:

```text
COMPLETED = id 12
CANCELED  = id 13
```

## Integracion McLeod

Archivo:

```text
src/integrations/api_mcleod/mcleod.endpoints.js
```

Funciones:

```js
getOrders(query, company)
getStop(stopId, company)
getMoveEquipment(equipmentGroupId, company)
```

Autenticacion:

```text
ebt / TMS    -> MCLEOD_API_TOKEN
ebf / TMS2   -> MCLEOD_API_USER + MCLEOD_API_PASS
tedel / TMS3 -> MCLEOD_API_USER + MCLEOD_API_PASS
```

## Resumen Visual

```text
server.js
  -> cron/index.js
    -> cron/crosses.cron.js
      -> jobs/crosses/crossesInit.job.js
        -> services/crosses/crossesInit.service.js
          -> crossesSync.service.js
          -> crossesStopsPayload.service.js
          -> crossesAssignmentsPayload.service.js
          -> crossesPayload.service.js
          -> crossesInitPersistence.service.js

routes/index.js
  -> routes/login/login.routes.js
  -> routes/crosses/crosses.routes.js
```
