import { fetchMcleodData, fetchMcleodItem } from './mcleod.config.js';

// ========================================
// GET ORDERS
// ========================================

export const getOrders = async ( query, company = 'ebt' ) => {

    const data = await fetchMcleodData(
        `/orders/search?${query}`,
        company,
    );

    return data;

}

// ========================================
// GET MOVES
// ========================================

export const getMoves = async ( query, company = 'ebt' ) => {

    const data = await fetchMcleodData(
        `/movements/search?${query}`,
        company,
    );

    return data;

}

// ========================================
// GET EQUIPMENT
// ========================================

export const getMoveEquipment = async ( equipmentId, company = 'ebt' ) => {
    
    const data = await fetchMcleodData(
        `/equipment_item/search?equipment_group_id=${encodeURIComponent(equipmentId)}`,
        company,
    );

    return data;
    
}

// ========================================
// GET STOPS
// ========================================

export const getStop = async ( stopId, company = 'ebt' ) => {
    
    const data = await fetchMcleodItem(
        `/stops/${stopId}`,
        company,
    );

    return data;
    
}