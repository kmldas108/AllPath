import React, { useState } from 'react';
import { Account, Role } from '../types';
import {
  createAccount,
  listAccounts,
  signIn,
  hasAnyAccount,
} from '../services/accountStore';

// Sign-in for the shared device (spec 10a). Teacher and learner each have their own account.
// Everything here is local: no request leaves the device during account creation or sign-in.

interface Props {
  onSignedIn: (account: Account) => void;
}

const LoginView: React.FC<Props> = ({ onSignedIn }) => {
  const firstRun = !hasAnyAccount();
  const [creating, setCreating] = useState(firstRun);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(firstRun ? Role.TEACHER : Role.LEARNER);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (creating) {
        const account = await createAccount(username, password, role);
        await signIn(username, password);
        onSignedIn(account);
      } else {
        const account = await signIn(username, password);
        if (!account) {
          setError('That username and password do not match an account on this device.');
          return;
        }
        onSignedIn(account);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-5"
        aria-label={creating ? 'Create an account' : 'Sign in'}
      >
        <div>
          <h1 className="text-2xl font-black text-slate-800">Samaveshi</h1>
          <p className="text-slate-600 mt-1">
            {firstRun
              ? 'Set up the teacher account for this device.'
              : creating
                ? 'Add an account to this device.'
                : 'Sign in to continue.'}
          </p>
        </div>

        <label className="block">
          <span className="block text-sm font-bold text-slate-700 mb-1">Username</span>
          <input
            className="w-full border-2 border-slate-200 rounded-lg px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="block">
          <span className="block text-sm font-bold text-slate-700 mb-1">Password</span>
          <input
            type="password"
            className="w-full border-2 border-slate-200 rounded-lg px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={creating ? 'new-password' : 'current-password'}
            required
          />
        </label>

        {creating && !firstRun && (
          <fieldset className="block">
            <legend className="block text-sm font-bold text-slate-700 mb-1">
              This account is for
            </legend>
            <div className="flex gap-2">
              {[Role.LEARNER, Role.TEACHER].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 py-2 rounded-lg font-bold border-2 ${
                    role === r
                      ? 'border-purple-500 bg-purple-50 text-purple-900'
                      : 'border-slate-200 text-slate-600'
                  }`}
                  aria-pressed={role === r}
                >
                  {r === Role.LEARNER ? 'A learner' : 'A teacher'}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="text-red-600 font-semibold text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-purple-600 text-white font-black py-3 rounded-lg disabled:opacity-50"
        >
          {creating ? 'Create account' : 'Sign in'}
        </button>

        {!firstRun && (
          <button
            type="button"
            onClick={() => {
              setCreating(!creating);
              setError(null);
            }}
            className="w-full text-slate-600 text-sm underline"
          >
            {creating
              ? 'Back to sign in'
              : `Add another account (${listAccounts().length} on this device)`}
          </button>
        )}
      </form>
    </div>
  );
};

export default LoginView;
