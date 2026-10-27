import test from 'node:test';
import assert from 'node:assert/strict';
import { getEtaChange, notifyEtaChangeIfNeeded } from '../src/services/notifications/etaChangeNotification.service.js';

const previousEta = '2026-10-23 10:00:00';

test('only delays strictly greater than one hour qualify', () => {
    for (const next of ['2026-10-23 10:00:00', '2026-10-23 10:59:59', '2026-10-23 11:00:00', '2026-10-23 09:00:00', '2026-10-23 08:59:59', '2026-10-22 10:00:00']) {
        assert.equal(getEtaChange(previousEta, next), null);
    }
    assert.equal(getEtaChange(previousEta, '2026-10-23 11:00:01').differenceMs, 3601000);
    assert.equal(getEtaChange('2026-10-23 23:30:00', '2026-10-24 00:30:01').differenceMs, 3601000);
});

test('missing and invalid dates never qualify in either position', () => {
    for (const value of [null, undefined, '', 'bad date', '2026-02-30 10:00:00', '2026-13-23 10:00:00', '2026-10-23 25:00:00', new Date(NaN), 0]) {
        assert.equal(getEtaChange(value, previousEta), null);
        assert.equal(getEtaChange(previousEta, value), null);
    }
});

test('mysql Date objects and SQL strings use the same local time', () => {
    assert.equal(getEtaChange(new Date(2026, 9, 23, 10), '2026-10-23 11:00:00'), null);
    assert.equal(getEtaChange(previousEta, new Date(2026, 9, 23, 11, 0, 1)).differenceMs, 3601000);
});

test('small successive changes do not accumulate', () => {
    assert.equal(getEtaChange(previousEta, '2026-10-23 10:40:00'), null);
    assert.equal(getEtaChange('2026-10-23 10:40:00', '2026-10-23 11:20:00'), null);
});

const buildFixture = () => {
    const calls = { recipients: [], emails: [], logs: [] };
    const dependencies = {
        getRecipients: async (query) => {
            calls.recipients.push(query);
            return [1, 2].map(() => ({
                recipient_value: 'test@example.com',
                notification_reason_id: 7,
                notification_channel_id: 1,
            }));
        },
        sendEmail: async (email) => { calls.emails.push(email); },
        insertLog: async (log) => { calls.logs.push(log); },
    };
    const input = {
        previousEta,
        newEta: '2026-10-23 11:00:01',
        cross: { customer_group_id: 3, trailer_id: '123', mcleod_order_id: '456' },
        stop: { id: 9, stop_name: '<Destino>' },
    };
    return { calls, dependencies, input };
};

test('nonqualifying updates do not look up recipients, send, or log', async () => {
    const { calls, dependencies, input } = buildFixture();
    for (const newEta of [null, previousEta, '2026-10-23 11:00:00', '2026-10-23 09:00:00', '2026-10-23 08:59:59', '2026-10-22 10:00:00']) {
        assert.equal((await notifyEtaChangeIfNeeded({ ...input, newEta }, dependencies)).status, 'NOT_REQUIRED');
    }
    assert.deepEqual(calls, { recipients: [], emails: [], logs: [] });
});

test('status IDs 1, 12 and 13 never look up recipients, send, or log', async () => {
    const { calls, dependencies, input } = buildFixture();
    for (const status of [
        { cross_status_id: 1 },
        { cross_status_id: '1' },
        { cross_status_id: 12 },
        { cross_status_id: '12' },
        { cross_status_id: 13 },
        { cross_status_id: '13' },
    ]) {
        assert.deepEqual(await notifyEtaChangeIfNeeded({
            ...input,
            cross: { ...input.cross, ...status },
        }, dependencies), { status: 'NOT_REQUIRED', reason: 'excluded_status' });
    }
    assert.deepEqual(calls, { recipients: [], emails: [], logs: [] });
});

test('status names and codes do not exclude an allowed status ID', async () => {
    const { calls, dependencies, input } = buildFixture();
    for (const status of ['COMPLETED', 'completado']) {
        assert.equal((await notifyEtaChangeIfNeeded({
            ...input,
            cross: { ...input.cross, cross_status_id: 11, status_code: status, status_name: status },
        }, dependencies)).status, 'SENT');
    }
    assert.equal(calls.emails.length, 2);
});

test('qualifying update uses configured active email recipients and logs the stop', async () => {
    const { calls, dependencies, input } = buildFixture();
    input.cross.cross_status_id = 11;
    input.cross.status_code = 'IN_TRANSIT_TO_CUSTOMER';
    assert.equal((await notifyEtaChangeIfNeeded(input, dependencies)).status, 'SENT');
    assert.equal(calls.recipients[0].customer_group_id, 3);
    assert.equal(calls.recipients[0].notification_channel_code, 'EMAIL');
    assert.equal(calls.recipients[0].is_active, 1);
    assert.equal(calls.recipients[0].notification_reason_code, process.env.ETA_CHANGE_NOTIFICATION_REASON_CODE || 'CHANGED_ETA');
    assert.deepEqual(calls.emails[0].destinatarios, ['test@example.com']);
    assert.match(calls.emails[0].html, /&lt;Destino&gt;/);
    assert.match(calls.emails[0].html, /10:00:00/);
    assert.match(calls.emails[0].html, /11:00:01/);
    assert.match(calls.emails[0].html, /minutos \(retraso\)/);
    assert.doesNotMatch(calls.emails[0].html, /adelanto/);
    assert.equal(calls.logs[0].entity_id, 9);
    assert.equal(calls.logs[0].status, 'SENT');
});

test('missing group or recipients skips delivery', async () => {
    const { calls, dependencies, input } = buildFixture();
    assert.equal((await notifyEtaChangeIfNeeded({ ...input, cross: {} }, dependencies)).reason, 'missing_customer_group');
    dependencies.getRecipients = async () => [];
    assert.equal((await notifyEtaChangeIfNeeded(input, dependencies)).reason, 'missing_recipients');
    assert.equal(calls.emails.length, 0);
    assert.equal(calls.logs.length, 0);
});

test('email failures are logged without throwing into synchronization', async () => {
    const { calls, dependencies, input } = buildFixture();
    dependencies.sendEmail = async () => { throw new Error('Email unavailable'); };
    assert.equal((await notifyEtaChangeIfNeeded(input, dependencies)).status, 'FAILED');
    assert.equal(calls.logs[0].status, 'FAILED');
    dependencies.insertLog = async () => { throw new Error('Log unavailable'); };
    assert.equal((await notifyEtaChangeIfNeeded(input, dependencies)).status, 'ERROR');
});
