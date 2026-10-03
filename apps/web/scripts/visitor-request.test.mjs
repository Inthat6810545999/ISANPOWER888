import assert from 'node:assert/strict';
import test from 'node:test';
import { bangkokDate, validateVisit, isVisitReceipt, EMPTY_VISIT } from '../src/features/visitor-request/validation.ts';
const today = '2026-10-03';
const valid = { ...EMPTY_VISIT, contactName: ' Visitor ', email: 'visitor@example.test', purpose: 'study', details: 'Learn about IoT', visitDate: today, timeSlot: 'morning', visitorCount: '2' };
test('valid visit trims contact and permits blank optional fields', () => {
  const result = validateVisit(valid, today);
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.contactName, 'Visitor');
});
test('rejects impossible and past dates but accepts leap day', () => {
  for (const visitDate of ['2026-02-30', '2026-10-02', 'bad']) assert.ok(validateVisit({ ...valid, visitDate }, today).errors.visitDate);
  assert.equal(validateVisit({ ...valid, visitDate: '2028-02-29' }, today).errors.visitDate, undefined);
});
test('Bangkok day rolls over before UTC day', () => {
  assert.equal(bangkokDate(new Date('2026-10-02T17:00:00Z')), today);
});
test('rejects invalid headcount and forged enum values', () => {
  for (const visitorCount of ['0', '-1', '1.5', '1e2', '9007199254740992']) assert.ok(validateVisit({ ...valid, visitorCount }, today).errors.visitorCount);
  assert.ok(validateVisit({ ...valid, purpose: 'toString', timeSlot: 'overnight' }, today).errors.purpose);
  assert.ok(validateVisit({ ...valid, timeSlot: 'overnight' }, today).errors.timeSlot);
});
test('rejects missing, malformed and overlong contact data', () => {
  assert.ok(validateVisit(null, today).errors.contactName);
  assert.ok(validateVisit({ ...valid, contactName: '   ', email: 'bad', details: ' ' }, today).errors.email);
  assert.ok(validateVisit({ ...valid, contactName: 'x'.repeat(121) }, today).errors.contactName);
  assert.ok(validateVisit({ ...valid, email: ['visitor@example.test'] }, today).errors.email);
});
test('receipt must have a request ID and a well-formed server tracking code', () => {
  assert.equal(isVisitReceipt({ requestId: 'saved-id', trackingCode: 'Abcdef123456_xyz' }), true);
  for (const receipt of [null, {}, { requestId: 'saved-id', trackingCode: '' }, { requestId: '', trackingCode: 'Abcdef123456_xyz' }, { requestId: 'saved-id', trackingCode: '<script>alert(1)</script>' }]) assert.equal(isVisitReceipt(receipt), false);
});
