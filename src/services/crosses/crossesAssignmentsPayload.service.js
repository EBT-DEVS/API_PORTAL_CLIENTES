import { getMoveEquipment } from '../../integrations/api_mcleod/mcleod.endpoints.js';
import { getCrossAssignmentByEquipmentGroupOrMove } from '../../models/crosses/crosses.assignments.model.js';

const compactDateTimePattern = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:[+-]\d{4})?$/;

const firstValue = (...values) => (
    values.find((value) => value !== undefined && value !== null && value !== '') ?? null
);

const normalizeArray = (value) => {

    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];

};

const normalizeDateTime = (value) => {

    if (!value) {
        return null;
    }

    const rawValue = String(value).trim();
    const compactMatch = rawValue.match(compactDateTimePattern);

    if (compactMatch) {
        const [, year, month, day, hour, minute, second] = compactMatch;
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }

    const isoMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);

    return isoMatch ? `${isoMatch[1]} ${isoMatch[2]}` : rawValue;

};

const getOrderId = (order) => firstValue(
    order?.id,
    order?.order_id,
    order?.mcleod_order_id,
    order?.order_number,
);

const getOrderMovements = (order) => normalizeArray(firstValue(
    order?.movement,
    order?.movements,
));

const getMoveId = (movement) => firstValue(
    movement?.id,
    movement?.move_id,
    movement?.movement_id,
);

const getEquipmentGroupId = (movement) => firstValue(
    movement?.equipment_group_id,
    movement?.equipmentGroupId,
);

const getEquipmentId = (equipment) => firstValue(
    equipment?.equipment_id,
    equipment?.equipmentId,
    equipment?.id,
);

const mapCachedAssignment = ({ cachedAssignment, order, movement }) => ({
    cross_id: null,
    equipment_group_id: cachedAssignment.equipment_group_id || getEquipmentGroupId(movement),
    move_id: cachedAssignment.move_id || getMoveId(movement),
    origin_stop_id: null,
    destination_stop_id: null,
    trailer_id: cachedAssignment.trailer_id || null,
    tractor_id: cachedAssignment.tractor_id || null,
    driver_1_id: cachedAssignment.driver_1_id || null,
    driver_2_id: cachedAssignment.driver_2_id || null,
    is_team: Number(cachedAssignment.is_team || 0),
    is_current: Number(cachedAssignment.is_current ?? 1),
    assigned_at: normalizeDateTime(cachedAssignment.assigned_at),
    released_at: normalizeDateTime(cachedAssignment.released_at),
    _source: 'DB_CACHE',
    _cached_assignment_id: cachedAssignment.id,
    _mcleod_order_id: getOrderId(order),
    _origin_mcleod_stop_id: movement?.origin_stop_id || null,
    _destination_mcleod_stop_id: movement?.dest_stop_id || null,
});

const mapEquipmentAssignment = ({ equipmentItems, order, movement }) => {

    const trailers = equipmentItems.filter((item) => item.equipment_type_id === 'L');
    const tractors = equipmentItems.filter((item) => item.equipment_type_id === 'T');
    const drivers = equipmentItems.filter((item) => item.equipment_type_id === 'D');

    return {
        cross_id: null,
        equipment_group_id: getEquipmentGroupId(movement),
        move_id: getMoveId(movement),
        origin_stop_id: null,
        destination_stop_id: null,
        trailer_id: getEquipmentId(trailers[0]) || null,
        tractor_id: getEquipmentId(tractors[0]) || null,
        driver_1_id: getEquipmentId(drivers[0]) || null,
        driver_2_id: getEquipmentId(drivers[1]) || null,
        is_team: drivers.length > 1 ? 1 : 0,
        is_current: 1,
        assigned_at: normalizeDateTime(firstValue(
            movement?.assigned_at,
            movement?.dispatch_date,
            movement?.est_tolls_d,
            order?.ordered_date,
        )),
        released_at: null,
        _source: 'MCLEOD',
        _mcleod_order_id: getOrderId(order),
        _origin_mcleod_stop_id: movement?.origin_stop_id || null,
        _destination_mcleod_stop_id: movement?.dest_stop_id || null,
        _equipment_items: equipmentItems,
    };

};

export const buildCrossAssignmentPayloadFromMovement = async ({
    order,
    movement,
    company = 'ebt',
    refetchAssignments = false,
} = {}) => {

    const equipmentGroupId = getEquipmentGroupId(movement);
    const moveId = getMoveId(movement);

    if (!equipmentGroupId) {
        return {
            isResolved: false,
            skipReason: 'missing_equipment_group_id',
            assignment: {
                cross_id: null,
                equipment_group_id: null,
                move_id: moveId,
                origin_stop_id: null,
                destination_stop_id: null,
                trailer_id: null,
                tractor_id: null,
                driver_1_id: null,
                driver_2_id: null,
                is_team: 0,
                is_current: 1,
                assigned_at: null,
                released_at: null,
                _source: null,
                _mcleod_order_id: getOrderId(order),
                _origin_mcleod_stop_id: movement?.origin_stop_id || null,
                _destination_mcleod_stop_id: movement?.dest_stop_id || null,
            },
        };
    }

    if (!refetchAssignments) {
        const cachedAssignment = await getCrossAssignmentByEquipmentGroupOrMove({
            equipmentGroupId,
            moveId,
        });

        if (cachedAssignment) {
            return {
                isResolved: true,
                skipReason: null,
                assignment: mapCachedAssignment({
                    cachedAssignment,
                    order,
                    movement,
                }),
            };
        }
    }

    const equipmentItems = await getMoveEquipment(equipmentGroupId, company);

    return {
        isResolved: true,
        skipReason: null,
        assignment: mapEquipmentAssignment({
            equipmentItems,
            order,
            movement,
        }),
    };

};

export const buildCrossAssignmentsPayloadFromOrder = async ({
    order,
    company = 'ebt',
    refetchAssignments = false,
} = {}) => {

    const movements = getOrderMovements(order);
    const assignments = [];
    const skippedAssignments = [];

    for (const movement of movements) {
        const result = await buildCrossAssignmentPayloadFromMovement({
            order,
            movement,
            company,
            refetchAssignments,
        });

        if (result.isResolved) {
            assignments.push(result.assignment);
        } else {
            skippedAssignments.push(result);
        }
    }

    return {
        orderId: getOrderId(order),
        movementsCount: movements.length,
        assignmentsCount: assignments.length,
        skippedAssignmentsCount: skippedAssignments.length,
        assignments,
        skippedAssignments,
    };

};

export const buildCrossAssignmentsPayloadsFromOrders = async ({
    orders = [],
    company = 'ebt',
    refetchAssignments = false,
} = {}) => {

    const payloads = [];

    for (const order of orders) {
        payloads.push(await buildCrossAssignmentsPayloadFromOrder({
            order,
            company,
            refetchAssignments,
        }));
    }

    const skippedAssignments = payloads.flatMap((payload) => payload.skippedAssignments);

    return {
        ordersCount: orders.length,
        assignmentsCount: payloads.reduce((total, payload) => total + payload.assignmentsCount, 0),
        skippedAssignmentsCount: skippedAssignments.length,
        refetchAssignments,
        payloads,
        skippedAssignments,
    };

};
