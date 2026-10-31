const { calculateBalance, assertPaymentWithinDues } = require('../../modules/feeCollection/feeMath');
const { calculateNetSalary, buildSalarySlip } = require('../../modules/payroll/payrollMath');
const { formatReceiptNumber } = require('../../utils/receiptNumber');

describe('fee calculations', () => {
  test('calculates partial, full, and advance balances', () => {
    expect(calculateBalance(100000, 40000)).toEqual({ pendingPaise: 60000, advancePaise: 0 });
    expect(calculateBalance(100000, 100000)).toEqual({ pendingPaise: 0, advancePaise: 0 });
    expect(calculateBalance(100000, 125000)).toEqual({ pendingPaise: 0, advancePaise: 25000 });
  });

  test('rejects overpayment unless the policy explicitly allows it', () => {
    expect(() => assertPaymentWithinDues({
      amountPaise: 150,
      pendingPaise: 100,
      allowOverpayment: false,
    })).toThrow(/Overpayment is not allowed/);

    expect(() => assertPaymentWithinDues({
      amountPaise: 150,
      pendingPaise: 100,
      allowOverpayment: true,
    })).not.toThrow();

    expect(() => assertPaymentWithinDues({
      amountPaise: 0,
      pendingPaise: 100,
      allowOverpayment: false,
    })).toThrow(/greater than zero/);
  });
});

describe('salary calculations', () => {
  const payroll = {
    employeeId: 'emp_1001',
    employeeCode: 'EMP1001',
    employeeName: 'Meera Iyer',
    designation: 'Senior Teacher',
    department: 'Mathematics',
    month: 10,
    year: 2026,
    basicSalaryPaise: 10000,
    allowances: [{ code: 'HRA', label: 'House Rent Allowance', amountPaise: 2000 }],
    deductions: [{ code: 'PF', label: 'Provident Fund', amountPaise: 3000 }],
    totalAllowancesPaise: 2000,
    totalDeductionsPaise: 3000,
    netSalaryPaise: 9000,
    status: 'processed',
    processedAt: new Date('2026-10-31T00:00:00.000Z'),
    paidAt: null,
  };

  test('calculates net salary as basic plus allowances minus deductions', () => {
    expect(calculateNetSalary({
      basicPaise: 10000,
      allowances: payroll.allowances,
      deductions: payroll.deductions,
    })).toEqual({
      totalAllowancesPaise: 2000,
      totalDeductionsPaise: 3000,
      netSalaryPaise: 9000,
    });
  });

  test('rejects deductions that would make net salary negative', () => {
    expect(() => calculateNetSalary({
      basicPaise: 10000,
      allowances: [],
      deductions: [{ amountPaise: 15000 }],
    })).toThrow(/cannot exceed/);
  });

  test('builds a salary slip from the stored payroll snapshot', () => {
    const slip = buildSalarySlip(payroll, 'Northbridge Educational Institute');
    expect(slip).toMatchObject({
      institutionName: 'Northbridge Educational Institute',
      employeeName: 'Meera Iyer',
      employeeCode: 'EMP1001',
      designation: 'Senior Teacher',
      periodLabel: 'October 2026',
      basicSalary: 100,
      totalAllowances: 20,
      totalDeductions: 30,
      netSalary: 90,
      status: 'processed',
    });
    expect(slip.allowances[0]).toEqual({ code: 'HRA', label: 'House Rent Allowance', amount: 20 });
  });
});

describe('receipt numbers', () => {
  test('formats a yearly sequence', () => {
    expect(formatReceiptNumber(2026, 1)).toBe('RCP-2026-000001');
    expect(formatReceiptNumber(2026, 42)).toBe('RCP-2026-000042');
  });
});
