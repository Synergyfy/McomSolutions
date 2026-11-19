import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import CHSLogo from '../../components/CHSLogo';
import { ErrorNote } from '../../components/local-affiliate/ui';
import { localAffiliateApi } from '../../services/local-affiliate';
import { useActivateAffiliate } from '../../services/local-affiliate/hooks';

const TERMS_VERSION = '2026-11-01';

/**
 * Join as a Local Affiliate.
 *
 * Two paths, exactly as the model requires:
 *   • signed in  → activate a profile on the existing CHS identity (no new user);
 *   • signed out → create the identity and the profile in one journey.
 */
export default function JoinAffiliatePage() {
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Scenario B finishes with an emailed code; the profile stays PENDING until
  // it is proven, so sharing links cannot be used before verification.
  const [pendingVerification, setPendingVerification] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    postcode: '',
    acceptTerms: false,
  });

  const activate = useActivateAffiliate();

  const onActivate = async () => {
    setError(null);
    setBusy(true);
    try {
      await activate.mutateAsync({ termsVersion: TERMS_VERSION, acceptTerms: true });
      navigate('/affiliate-hub');
    } catch (e: any) {
      setError(
        e?.response?.data?.message === 'TERMS_VERSION_OUTDATED'
          ? 'The affiliate terms have been updated. Please reload the page and try again.'
          : e?.response?.data?.message === 'AFFILIATE_NOT_ELIGIBLE'
            ? 'This account type cannot hold an affiliate profile.'
            : 'Could not activate your affiliate profile. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async (event: FormEvent) => {
    event.preventDefault();
    setOtpError(null);
    setBusy(true);
    try {
      await localAffiliateApi.verifyEmail(otp.trim());
      navigate('/affiliate-hub');
    } catch (e: any) {
      setOtpError(
        e?.response?.data?.message === 'INVALID_VERIFICATION_CODE'
          ? 'That code is not valid or has expired.'
          : 'Could not verify the code. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    setOtpError(null);
    try {
      await localAffiliateApi.resendVerification();
    } catch {
      setOtpError('Could not resend the code right now.');
    }
  };

  const onRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.acceptTerms) {
      setError('Please accept the affiliate terms to continue.');
      return;
    }
    setBusy(true);
    try {
      const result = await localAffiliateApi.register({
        email: form.email,
        password: form.password,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        phone: form.phone || undefined,
        postcode: form.postcode || undefined,
        termsVersion: TERMS_VERSION,
        acceptTerms: true,
      });
      if (result.accessToken) {
        localStorage.setItem('auth_token', result.accessToken);
      }
      if (result.data?.status === 'PENDING') {
        setPendingVerification(true);
        return;
      }
      navigate('/affiliate-hub');
    } catch (e: any) {
      const message = e?.response?.data?.message;
      setError(
        message === 'EMAIL_ALREADY_REGISTERED'
          ? 'An account with this email already exists. Sign in first, then activate your affiliate profile.'
          : Array.isArray(e?.response?.data?.errors)
            ? e.response.data.errors[0]
            : 'Could not create your account. Please check your details and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-2">
        <section>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
            <Sparkles className="h-5 w-5 text-orange-700" />
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            Earn by sharing what you already recommend
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Local Affiliates share offers from MCOM Mall, local businesses and approved partners.
            You keep one CHS account — this adds an affiliate profile, not a second login.
          </p>
          <ul className="mt-5 space-y-3">
            {[
              'Points and vouchers, with a clear pending → available history.',
              'One dashboard for every product source.',
              'No agency recruitment process — this is a consumer programme.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          {pendingVerification ? (
            <form onSubmit={onVerify} className="space-y-3">
              <h2 className="text-base font-semibold text-slate-900">Verify your email</h2>
              <p className="text-xs text-slate-600">
                We sent a code to <strong>{form.email}</strong>. Enter it to activate your affiliate
                profile and start sharing offers.
              </p>
              <label className="block text-xs font-medium text-slate-600">
                Verification code
                <input
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest"
                  placeholder="000000"
                />
              </label>
              {otpError ? <ErrorNote message={otpError} /> : null}
              <button
                type="submit"
                disabled={busy || otp.trim().length < 4}
                className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {busy ? 'Verifying…' : 'Verify and continue'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <div className="flex items-center justify-between text-[11px]">
                <button type="button" onClick={onResend} className="font-semibold text-orange-700">
                  Resend code
                </button>
                <button type="button" onClick={() => navigate('/affiliate-hub')} className="text-slate-500">
                  Skip for now
                </button>
              </div>
            </form>
          ) : token ? (
            <>
              <h2 className="text-base font-semibold text-slate-900">Activate on your account</h2>
              <p className="mt-1 text-xs text-slate-600">
                You are signed in. We will add a Local Affiliate profile to your existing CHS
                identity and generate your permanent link.
              </p>
              {error ? <div className="mt-3"><ErrorNote message={error} /></div> : null}
              <button
                onClick={onActivate}
                disabled={busy}
                className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {busy ? 'Activating…' : 'Activate my affiliate profile'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-[11px] text-slate-500">
                By activating you accept the Local Affiliate terms (version {TERMS_VERSION}).
              </p>
            </>
          ) : (
            <form onSubmit={onRegister} className="space-y-3">
              <h2 className="text-base font-semibold text-slate-900">Create your account</h2>
              <p className="text-xs text-slate-600">
                Already have a CHS account?{' '}
                <Link to="/login?redirect=/join-affiliate" className="font-semibold text-orange-700">
                  Sign in
                </Link>{' '}
                and activate instead.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-slate-600">
                  First name
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Last name
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs font-medium text-slate-600">
                Email
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-xs font-medium text-slate-600">
                Password
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <span className="mt-1 block text-[11px] text-slate-500">At least 8 characters.</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-slate-600">
                  Phone (optional)
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Postcode (optional)
                  <input
                    value={form.postcode}
                    onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                    placeholder="B1 1AA"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={form.acceptTerms}
                  onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
                  className="mt-0.5"
                />
                I accept the Local Affiliate terms (version {TERMS_VERSION}).
              </label>

              {error ? <ErrorNote message={error} /> : null}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {busy ? 'Creating…' : 'Create account and activate'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
