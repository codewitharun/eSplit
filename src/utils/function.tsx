//function is used to trim the input object value
export function trimObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const trimmedObj: any = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (typeof value === 'string') {
        trimmedObj[key] = value.trim();
      } else if (typeof value === 'object') {
        trimmedObj[key] = trimObject(value);
      } else {
        trimmedObj[key] = value;
      }
    }
  }

  return trimmedObj;
}

export function hasEmptyValues(obj: any): boolean {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'object') {
        if (hasEmptyValues(value)) {
          return true;
        }
      } else if (typeof value === 'string') {
        if (value.trim() === '') {
          return true;
        }
      } else if (value === null || value === undefined) {
        return true;
      }
    }
  }
  return false;
}
