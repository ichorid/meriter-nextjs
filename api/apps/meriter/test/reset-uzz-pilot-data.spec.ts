import { parseResetArguments, resetUzzPilotData, UZZ_COLLECTIONS } from '../../../scripts/reset-uzz-pilot-data';

describe('reset UZZ pilot data safety', () => {
  it('is a dry run unless --apply and an environment-bound confirmation are present', () => {
    expect(parseResetArguments(['--environment=prod'])).toEqual({ environment: 'PROD', apply: false, confirmation: null });
    expect(() => parseResetArguments(['--environment=prod', '--apply'])).toThrow('RESET_UZZ_PROD');
    expect(() => parseResetArguments(['--environment=prod', '--apply', '--confirm=RESET_UZZ_DEV'])).toThrow('RESET_UZZ_PROD');
    expect(parseResetArguments(['--environment=prod', '--apply', '--confirm=RESET_UZZ_PROD']).apply).toBe(true);
  });

  it('touches only the literal UZZ allowlist', async () => {
    const touched: string[] = []; const deleted: string[] = [];
    const db = { collection: (name: string) => ({ countDocuments: async () => { touched.push(name); return 1; }, deleteMany: async () => { deleted.push(name); return { deletedCount: 1 }; } }) };
    await resetUzzPilotData(db as never, { environment: 'TEST', apply: true, confirmation: 'RESET_UZZ_TEST' });
    expect(touched).toEqual([...UZZ_COLLECTIONS]); expect(deleted).toEqual([...UZZ_COLLECTIONS]);
    expect(touched).not.toEqual(expect.arrayContaining(['users', 'wallets', 'publications', 'communities']));
  });

  it('does not delete during a dry run', async () => {
    const deleteMany = jest.fn(); const db = { collection: () => ({ countDocuments: async () => 2, deleteMany }) };
    const rows = await resetUzzPilotData(db as never, { environment: 'DEV', apply: false, confirmation: null });
    expect(deleteMany).not.toHaveBeenCalled(); expect(rows.every((row) => row.deleted === 0)).toBe(true);
  });
});
