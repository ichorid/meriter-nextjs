import { extractTaskId } from './yougile-webhook.controller';

describe('extractTaskId', () => {
  it('reads payload.id (YouGile event shape)', () => {
    expect(
      extractTaskId({ event: 'task-moved', payload: { id: 'task-1' } }),
    ).toBe('task-1');
  });

  it('reads nested task.id', () => {
    expect(extractTaskId({ task: { id: 'task-2' } })).toBe('task-2');
  });

  it('reads flat taskId', () => {
    expect(extractTaskId({ taskId: 'task-3' })).toBe('task-3');
  });

  it('returns null for unrecognized bodies', () => {
    expect(extractTaskId(null)).toBeNull();
    expect(extractTaskId('string')).toBeNull();
    expect(extractTaskId({ event: 'task-moved' })).toBeNull();
    expect(extractTaskId({ payload: { id: 42 } })).toBeNull();
  });
});
