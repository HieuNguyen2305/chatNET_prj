export const encryptCaesar = (text: string, shift: number): string => {
  if (!text) return '';
  
  shift = ((shift % 26) + 26) % 26;
  
  return text
    .split('')
    .map(char => {
      const code = char.charCodeAt(0);
      
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + shift) % 26) + 65);
      }
      
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + shift) % 26) + 97);
      }
      
      if (code >= 48 && code <= 57) {
        return String.fromCharCode(((code - 48 + shift) % 10) + 48);
      }
      
      return char;
    })
    .join('');
};

export const decryptCaesar = (text: string, shift: number): string => {
  if (!text) return '';
  return encryptCaesar(text, -shift);
};

export const isValidKey = (key: string): boolean => {
  const numKey = parseInt(key, 10);
  return !isNaN(numKey) && numKey > 0 && numKey <= 25;
};

export const parseKey = (key: string): number => {
  return parseInt(key, 10) || 0;
};
