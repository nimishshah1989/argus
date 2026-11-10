import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../api.js';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function submit(event: React.FormEvent) {
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
    <main>
      <h1>Uptimo</h1>
      <form onSubmit={submit}>
        <input
          autoFocus
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p>{error}</p>}
        <button className="primary" type="submit">
          Sign in
        </button>
      </form>
    </main>
  );
}
