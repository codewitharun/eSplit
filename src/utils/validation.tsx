export const nameValidator = (name?: string): string | null => {
  const specialCharReg = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
  const emojiReg =
    /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/gi;

  if (!name || !name.trim()) {
    return 'Name cannot be empty';
  }
  if (name.length < 2 || name.length > 50) {
    return 'Name must be between 2 and 50 characters';
  }
  if (specialCharReg.test(name)) {
    return 'Name cannot contain special characters';
  }
  if (emojiReg.test(name)) {
    return 'Name cannot contain emojis';
  }

  return null; // Name is valid
};

export const requiredValidator = (value: string): string | null => {
  return value.trim() === '' ? 'This field is required' : null;
};

export const emailValidator = (value: string): string | null => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return !regex.test(value) ? 'Please enter a valid email' : null;
};

export const minLengthValidator = (
  value: string,
  minLength: number,
): string | null => {
  return value.length < minLength
    ? `Minimum length is ${minLength} characters`
    : null;
};

export const maxLengthValidator = (
  value: string,
  maxLength: number,
): string | null => {
  return value.length > maxLength
    ? `Maximum length is ${maxLength} characters`
    : null;
};

export const passwordValidator = (value: string): string | null => {
  const regex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
  return !regex.test(value)
    ? 'Password must be at least 6 characters long and contain a letter, a number, and a special character'
    : null;
};

export const phoneValidator = (value: string): string | null => {
  const regex = /^[0-9]{10}$/;
  return !regex.test(value)
    ? 'Please enter a valid phone number (10 digits)'
    : null;
};

export const matchPasswordValidator = (
  password: string,
  confirmPassword: string,
): string | null => {
  return password !== confirmPassword ? 'Passwords do not match' : null;
};

export const numericValidator = (value: string): string | null => {
  const regex = /^\d+$/;
  return !regex.test(value) ? 'Only numbers are allowed' : null;
};

export const urlValidator = (value: string): string | null => {
  const regex = /^(https?|chrome):\/\/[^\s$.?#].[^\s]*$/;
  return !regex.test(value) ? 'Please enter a valid URL' : null;
};

export const alphaValidator = (value: string): string | null => {
  const regex = /^[A-Za-z]+$/;
  return !regex.test(value) ? 'Only letters are allowed' : null;
};

export const alphanumericValidator = (value: string): string | null => {
  const regex = /^[A-Za-z0-9]+$/;
  return !regex.test(value) ? 'Only letters and numbers are allowed' : null;
};

export const zipCodeValidator = (value: string): string | null => {
  const regex = /^[0-9]{5}(?:-[0-9]{4})?$/; // For US ZIP code (e.g., 12345 or 12345-6789)
  return !regex.test(value) ? 'Please enter a valid ZIP code' : null;
};

export const dateValidator = (value: string): string | null => {
  const regex = /^(0[1-9]|1[0-2])\/([0-2][1-9]|3[01])\/\d{4}$/; // MM/DD/YYYY format
  return !regex.test(value) ? 'Please enter a valid date (MM/DD/YYYY)' : null;
};

export const creditCardValidator = (value: string): string | null => {
  const regex =
    /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9]{2})[0-9]{12}|3[47][0-9]{13}|6(?:2131|1800|35)[0-9]{11})$/;
  return !regex.test(value) ? 'Please enter a valid credit card number' : null;
};

export const decimalValidator = (value: string): string | null => {
  const regex = /^\d+(\.\d+)?$/;
  return !regex.test(value) ? 'Please enter a valid decimal number' : null;
};

export const noSpecialCharsValidator = (value: string): string | null => {
  const regex = /^[A-Za-z0-9 ]*$/;
  return !regex.test(value) ? 'Special characters are not allowed' : null;
};

export const noWhitespaceValidator = (value: string): string | null => {
  return value.trim() !== value
    ? 'No leading or trailing spaces allowed'
    : null;
};

export const negativeNumberValidator = (value: string): string | null => {
  const regex = /^-\d+(\.\d+)?$/;
  return !regex.test(value) ? 'Only negative numbers are allowed' : null;
};

export const integerValidator = (value: string): string | null => {
  const regex = /^-?\d+$/;
  return !regex.test(value) ? 'Only integer numbers are allowed' : null;
};

export const lengthRangeValidator = (
  value: string,
  minLength: number,
  maxLength: number,
): string | null => {
  if (value.length < minLength)
    return `Minimum length is ${minLength} characters`;
  if (value.length > maxLength)
    return `Maximum length is ${maxLength} characters`;
  return null;
};

export const customValidator = (
  value: string,
  test: RegExp,
  errorMessage: string,
): string | null => {
  return !test.test(value) ? errorMessage : null;
};
