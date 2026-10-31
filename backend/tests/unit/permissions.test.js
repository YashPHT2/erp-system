const { normalizeRole, roleAllowed, permissionsForRole } = require('../../utils/permissions');

describe('permissions', () => {
  test('normalizes role text from the auth token', () => {
    expect(normalizeRole('Fee Clerk')).toBe('FEE_CLERK');
    expect(normalizeRole('accountant')).toBe('ACCOUNTANT');
    expect(normalizeRole(null)).toBe('');
  });

  test('allows only the agreed finance roles', () => {
    expect(roleAllowed('SUPER_ADMIN', 'feeStructure.write')).toBe(true);
    expect(roleAllowed('PRINCIPAL', 'feeStructure.write')).toBe(true);
    expect(roleAllowed('ACCOUNTANT', 'feeStructure.write')).toBe(false);
    expect(roleAllowed('FEE_CLERK', 'feeStructure.write')).toBe(false);
    expect(roleAllowed('TEACHER', 'feeStructure.write')).toBe(false);

    expect(roleAllowed('ACCOUNTANT', 'fees.collect')).toBe(true);
    expect(roleAllowed('FEE_CLERK', 'fees.collect')).toBe(true);
    expect(roleAllowed('FEE_CLERK', 'receipts.cancel')).toBe(true);
    expect(roleAllowed('PRINCIPAL', 'fees.collect')).toBe(false);
    expect(roleAllowed('TEACHER', 'fees.collect')).toBe(false);
    expect(roleAllowed('TEACHER', 'receipts.cancel')).toBe(false);

    expect(roleAllowed('ACCOUNTANT', 'payroll.write')).toBe(true);
    expect(roleAllowed('SUPER_ADMIN', 'payroll.write')).toBe(true);
    expect(roleAllowed('PRINCIPAL', 'payroll.write')).toBe(false);
    expect(roleAllowed('PRINCIPAL', 'payroll.read')).toBe(true);
    expect(roleAllowed('FEE_CLERK', 'payroll.write')).toBe(false);
  });

  test('does not grant a teacher any finance permission', () => {
    expect(permissionsForRole('TEACHER')).toEqual([]);
    expect(permissionsForRole('UNKNOWN')).toEqual([]);
  });
});
