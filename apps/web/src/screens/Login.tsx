import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../api.js';

const inputClass = 'min-h-13 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body?.error?.message ?? 'Sign-in failed');
      return;
    }
    setToken(body.token);
    navigate('/floor');
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Uptimo</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input
          autoFocus
          placeholder="Username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
        />
        {error && (
          <p role="alert" className="text-stopped">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="min-h-13 w-full rounded-xl bg-accent px-4 text-lg font-semibold text-white hover:bg-accent/90"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
