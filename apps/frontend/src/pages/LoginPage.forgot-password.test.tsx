import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AdminAuthProvider } from '../context/AdminAuthContext';

const { forgotMock, resetMock, checkEmailMock } = vi.hoisted(() => ({
  forgotMock: vi.fn(),
  resetMock: vi.fn(),
  checkEmailMock: vi.fn(),
}));

vi.mock('../services/auth/hooks', () => ({
  useLogin: () => ({ mutateAsync: vi.fn() }),
  usePostSsoAuthorize: () => ({ mutateAsync: vi.fn() }),
  useGetSsoToken: () => ({ mutateAsync: vi.fn() }),
  useCurrentUser: () => ({ data: null, isLoading: false }),
  useLogout: () => vi.fn(),
  useForgotPassword: () => ({ mutateAsync: forgotMock }),
  useResetPassword: () => ({ mutateAsync: resetMock }),
}));

vi.mock('../services/auth', () => ({
  authApi: { checkEmail: checkEmailMock },
}));

vi.mock('../services/api', () => ({
  setSharedAuthCookies: vi.fn(),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AdminAuthProvider>
        <LoginPage />
      </AdminAuthProvider>
    </MemoryRouter>,
  );
}

async function openForgotDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
  return screen.getByRole('dialog');
}

describe('LoginPage forgot-password flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the reset dialog from the login form', async () => {
    const user = userEvent.setup();
    renderLogin();

    const dialog = await openForgotDialog(user);
    expect(within(dialog).getByText('Reset your password')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Email Address')).toBeInTheDocument();
  });

  it('requests a code, then resets the password', async () => {
    forgotMock.mockResolvedValueOnce({ success: true, mode: 'mock', resetCode: '123456' });
    resetMock.mockResolvedValueOnce({ success: true });

    const user = userEvent.setup();
    renderLogin();
    const dialog = await openForgotDialog(user);

    await user.type(within(dialog).getByLabelText('Email Address'), 'user@example.com');
    await user.click(within(dialog).getByRole('button', { name: /Send reset code/ }));

    expect(await within(dialog).findByText(/Development mode: your reset code is 123456/)).toBeInTheDocument();
    expect(forgotMock).toHaveBeenCalledWith('user@example.com');
    expect(within(dialog).getByLabelText('Reset Code')).toHaveValue('123456');

    await user.type(within(dialog).getByLabelText('New Password'), 'NewPass1!');
    await user.type(within(dialog).getByLabelText('Confirm New Password'), 'NewPass1!');
    await user.click(within(dialog).getByRole('button', { name: /Reset password/ }));

    expect(await within(dialog).findByText('Password updated')).toBeInTheDocument();
    expect(resetMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      code: '123456',
      newPassword: 'NewPass1!',
    });
  });

  it('blocks submission when the passwords do not match', async () => {
    forgotMock.mockResolvedValueOnce({ success: true, mode: 'email' });

    const user = userEvent.setup();
    renderLogin();
    const dialog = await openForgotDialog(user);

    await user.type(within(dialog).getByLabelText('Email Address'), 'user@example.com');
    await user.click(within(dialog).getByRole('button', { name: /Send reset code/ }));
    await within(dialog).findByText(/A 6-digit reset code is on its way/);

    await user.type(within(dialog).getByLabelText('Reset Code'), '654321');
    await user.type(within(dialog).getByLabelText('New Password'), 'NewPass1!');
    await user.type(within(dialog).getByLabelText('Confirm New Password'), 'Different1!');
    await user.click(within(dialog).getByRole('button', { name: /Reset password/ }));

    expect(within(dialog).getByText('Passwords do not match.')).toBeInTheDocument();
    expect(resetMock).not.toHaveBeenCalled();
  });

  it('surfaces the server error when the account does not exist', async () => {
    forgotMock.mockRejectedValueOnce({
      response: { status: 409, data: { message: 'User with this email does not exist' } },
    });

    const user = userEvent.setup();
    renderLogin();
    const dialog = await openForgotDialog(user);

    await user.type(within(dialog).getByLabelText('Email Address'), 'nobody@example.com');
    await user.click(within(dialog).getByRole('button', { name: /Send reset code/ }));

    expect(await within(dialog).findByText('User with this email does not exist')).toBeInTheDocument();
  });
});
