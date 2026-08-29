import {buildUpiPayUri, isValidUpiVpa} from '../upi';

describe('upi helper', () => {
  it('builds a valid upi:// deep link', () => {
    const uri = buildUpiPayUri({
      payeeVpa: 'arun@okhdfcbank',
      payeeName: 'Arun Kumar',
      amount: 550,
      note: 'EzySplit settle-up',
    });
    expect(uri).toContain('upi://pay?');
    expect(uri).toContain('pa=arun%40okhdfcbank');
    expect(uri).toContain('am=550.00');
  });

  it('returns null when the payee has no VPA on file', () => {
    expect(
      buildUpiPayUri({payeeVpa: '', payeeName: 'Aman', amount: 100}),
    ).toBeNull();
  });

  it('validates VPA shape', () => {
    expect(isValidUpiVpa('arun@okhdfcbank')).toBe(true);
    expect(isValidUpiVpa('not-a-vpa')).toBe(false);
  });
});
