import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isMobileViewport, readActiveControlValue } from './activeControl.js';

function fakeDoc(values) {
  return {
    getElementById(id) {
      if (!(id in values)) return null;
      return { value: values[id] };
    },
  };
}

describe('isMobileViewport', () => {
  it('is true when the 900px query matches', () => {
    assert.equal(isMobileViewport(() => ({ matches: true })), true);
    assert.equal(isMobileViewport(() => ({ matches: false })), false);
  });
});

describe('readActiveControlValue', () => {
  it('reads the mobile disaster type on a phone, not the hidden desktop fire default', () => {
    const doc = fakeDoc({
      'disaster-type-select': 'fire',
      'disaster-type-select-mobile': 'flood',
    });
    const mobile = () => ({ matches: true });
    const desktop = () => ({ matches: false });
    assert.equal(
      readActiveControlValue(
        'disaster-type-select',
        'disaster-type-select-mobile',
        doc,
        mobile
      ),
      'flood'
    );
    assert.equal(
      readActiveControlValue(
        'disaster-type-select',
        'disaster-type-select-mobile',
        doc,
        desktop
      ),
      'fire'
    );
  });

  it('falls back when the preferred select is missing', () => {
    const doc = fakeDoc({ 'disaster-level-select-mobile': 'major' });
    assert.equal(
      readActiveControlValue(
        'disaster-level-select',
        'disaster-level-select-mobile',
        doc,
        () => ({ matches: false })
      ),
      'major'
    );
  });
});
