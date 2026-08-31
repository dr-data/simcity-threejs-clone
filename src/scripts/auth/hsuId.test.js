import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isHsuId, isLoginId, normalizeHsuId, parseRestoreCode, formatRestoreCode } from '../auth/hsuId.js';
import { buildCityFile, parseCityFile, isForeignCityFile } from '../save/cityFile.js';

describe('HSU ID', () => {
  it('accepts s123456 and rejects random names', () => {
    assert.equal(isHsuId('s123456'), true);
    assert.equal(isHsuId('S1234567'), true);
    assert.equal(isHsuId('student'), false);
    assert.equal(isHsuId('s12'), false);
    assert.equal(normalizeHsuId(' S123456 '), 's123456');
    assert.equal(isLoginId('admin'), true);
  });

  it('parses ID-bound restore codes, not city encodings', () => {
    assert.deepEqual(parseRestoreCode('s123456-k7m2'), { hsuId: 's123456', token: 'K7M2' });
    assert.equal(parseRestoreCode('X12345'), null);
    assert.equal(formatRestoreCode('S123456', 'ab12'), 's123456-AB12');
  });
});

describe('city file', () => {
  it('marks another student file as foreign so scores stay with the logged-in ID', () => {
    const file = buildCityFile({
      city: { size: 16, buildings: [] },
      budget: 100,
      ownerId: 's111111',
    });
    assert.equal(parseCityFile(file).ownerId, 's111111');
    assert.equal(isForeignCityFile(file, 's222222'), true);
    assert.equal(isForeignCityFile(file, 's111111'), false);
    assert.throws(() => parseCityFile({ city: {} }), /Not a Classroom SimCity/);
  });
});
