type ApiError = {
  message?: string;
  response?: { data?: { message?: string | string[]; code?: string }; status?: number };
  code?: string;
};

export async function assertSignupEmailAvailable(
  checkEmail: (email: string) => Promise<{ exists?: boolean }>,
  email: string,
): Promise<void> {
  const result = await checkEmail(email);
  if (result?.exists) {
    throw new Error('An account with this email already exists. Please log in instead.');
  }
}

export function isDuplicateSignupError(error: unknown): boolean {
  const e = (error || {}) as ApiError;
  const responseMessage = e.response?.data?.message;
  const message = (Array.isArray(responseMessage) ? responseMessage.join(' ') : responseMessage || e.message || '')
    .toLowerCase();
  return e.response?.status === 409 || e.response?.data?.code === 'EMAIL_EXISTS' ||
    e.code === 'EMAIL_EXISTS' || message.includes('email already registered') ||
    message.includes('email has been used') || message.includes('email_exists');
}

export function signupErrorMessage(error: unknown, fallback: string): string {
  const e = (error || {}) as ApiError;
  const responseMessage = e.response?.data?.message;
  const message = Array.isArray(responseMessage) ? responseMessage.join(', ') : responseMessage;
  return message || e.message || fallback;
}
