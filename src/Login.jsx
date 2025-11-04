import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, User, AlertCircle } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store user info in localStorage
      localStorage.setItem('user', JSON.stringify(data));

      // Navigate based on role
      if (role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/app');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(to bottom right, rgba(87, 194, 147, 0.1), rgba(87, 194, 147, 0.15))' }}>
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Apollo Enrichment</h1>
          <p className="text-gray-600">Please sign in to continue</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': 'rgb(102, 209, 163)' }}
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(87, 194, 147, 0.5)'}
                onBlur={(e) => e.target.style.boxShadow = ''}
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(87, 194, 147, 0.5)'}
                onBlur={(e) => e.target.style.boxShadow = ''}
                placeholder="Enter your password"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Login As
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setRole('user')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
                  role === 'user'
                    ? 'font-medium'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
                style={role === 'user' ? {
                  borderColor: 'rgb(102, 209, 163)',
                  backgroundColor: 'rgba(87, 194, 147, 0.1)',
                  color: 'rgb(69, 155, 118)'
                } : {}}
              >
                <User size={18} />
                User
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition ${
                  role === 'admin'
                    ? 'font-medium'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
                style={role === 'admin' ? {
                  borderColor: 'rgb(102, 209, 163)',
                  backgroundColor: 'rgba(87, 194, 147, 0.1)',
                  color: 'rgb(69, 155, 118)'
                } : {}}
              >
                <User size={18} />
                Admin
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-2"
            style={{ backgroundColor: loading ? '#9ca3af' : 'rgb(102, 209, 163)' }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = 'rgb(69, 155, 118)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = 'rgb(102, 209, 163)';
              }
            }}
          >
            <LogIn size={20} />
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-600">
          <p className="font-medium mb-2">Default credentials (use @tristone-partners.com domain):</p>
          <p>User: user@tristone-partners.com / user123</p>
          <p>Admin: admin@tristone-partners.com / admin123</p>
        </div>
      </div>
    </div>
  );
};

export default Login;

