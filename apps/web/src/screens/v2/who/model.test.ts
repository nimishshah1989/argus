// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../api.js';
import { whoChoices, whoError } from './model.js';

describe('S19 who is using this phone: model', () => {
  it('lists the people by name', () => {
    const people = [
      { id: 'p2', name: 'Ravi' },
      { id: 'p1', name: 'Asha' },
      { id: 'p3', name: 'Neelo' },
    ];
    expect(whoChoices(people).map((p) => p.id)).toEqual(['p1', 'p3', 'p2']);
  });

  it('asks to choose a name when the server refuses the person', () => {
    expect(whoError(new ApiError('validation', 'x', 'actingPersonId'))).toBe('signin.chooseName');
  });

  it('leaves every other failure to the caller', () => {
    expect(whoError(new ApiError('internal', 'x'))).toBeNull();
    expect(whoError(new TypeError('Failed to fetch'))).toBeNull();
  });
});
