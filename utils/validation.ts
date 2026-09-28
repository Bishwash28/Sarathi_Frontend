// List of common temporary / disposable email domain providers
const TEMP_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com',
  'sharklasers.com', 'dispostable.com', 'getnada.com', 'trashmail.com',
  'yopmail.com', 'throwawaymail.com', 'temp-mail.org', 'fakeinbox.com',
  'maildrop.cc', '027168.com', 'crazymailing.com', 'bupkis.org'
]);

/**
 * Sanitizes input to prevent HTML/Script injection.
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Validates if the input contains script tags or suspicious HTML tags.
 */
export function hasScriptTags(input: string): boolean {
  if (!input) return false;
  const scriptRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  const htmlTagRegex = /<[^>]+>/g;
  return scriptRegex.test(input) || htmlTagRegex.test(input);
}

/**
 * Validates Full Name: Letters, spaces, hyphens, and apostrophes only. No special symbols/numbers.
 */
export function validateName(name: string): { isValid: boolean; message?: string } {
  const sanitized = sanitizeInput(name);
  if (!sanitized) {
    return { isValid: false, message: 'Name is required' };
  }
  // Allow letters (including unicode), spaces, hyphens, apostrophes
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(sanitized)) {
    return { isValid: false, message: 'Name should only contain letters, spaces, or hyphens (no symbols/numbers).' };
  }
  if (sanitized.length < 2) {
    return { isValid: false, message: 'Name must be at least 2 characters long.' };
  }
  return { isValid: true };
}

/**
 * Validates Email address, excluding temporary email domains.
 */
export function validateEmail(email: string): { isValid: boolean; message?: string } {
  const sanitized = sanitizeInput(email);
  if (!sanitized) {
    return { isValid: false, message: 'Email address is required' };
  }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(sanitized)) {
    return { isValid: false, message: 'Please enter a valid email address.' };
  }
  
  const domain = sanitized.split('@')[1]?.toLowerCase();
  if (domain && TEMP_EMAIL_DOMAINS.has(domain)) {
    return { isValid: false, message: 'Temporary / disposable email addresses are not allowed.' };
  }
  
  return { isValid: true };
}

/**
 * Validates Password: Minimum 8 characters, uppercase, lowercase, and special symbol.
 */
export function validatePassword(password: string): { isValid: boolean; message?: string } {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }
  if (hasScriptTags(password)) {
    return { isValid: false, message: 'Password contains invalid characters or tags.' };
  }
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special symbol.' };
  }
  return { isValid: true };
}
