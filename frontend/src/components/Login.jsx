import { useState } from 'react'
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Mock authentication bypass for testing
      const mockUsers = [
        { email: 'admin@pharmatrace.com', password: 'Admin@123456', role: 'admin', firstName: 'Admin', lastName: 'User' },
        { email: 'manufacturer@pharmatrace.com', password: 'Mfg@123456', role: 'manufacturer', firstName: 'John', lastName: 'Smith' }
      ]

      const mockUser = mockUsers.find(u => u.email === formData.email && u.password === formData.password)
      
      if (mockUser) {
        // Create mock user session
        const mockResult = {
          success: true,
          user: {
            id: mockUsers.indexOf(mockUser) + 1,
            email: mockUser.email,
            role: mockUser.role,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName
          },
          token: `mock-token-${mockUser.email}`
        }
        
        // Store in localStorage
        localStorage.setItem('authToken', mockResult.token)
        localStorage.setItem('user', JSON.stringify(mockResult.user))
        
        // Navigate based on role
        if (mockUser.role === 'admin') {
          navigate('/admin')
        } else if (mockUser.role === 'manufacturer') {
          navigate('/manufacturer')
        } else if (mockUser.role === 'vendor') {
          navigate('/vendor')
        } else {
          navigate('/dashboard')
        }
        return
      }

      // If not mock user, try normal authentication
      let result
      if (isLogin) {
        result = await login(formData.email, formData.password)
      } else {
        result = await register({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName
        })
      }

      if (result.success) {
        navigate('/scan')
      } else {
        setError(result.error)
      }
    } catch (err) {
      console.error('Submit error:', err)
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }


  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo">
            <h1>PharmaTrace</h1>
            <p>Medicine Authentication System</p>
          </div>
        </div>

        <div className="auth-form">
          <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
          
          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <div className="input-group">
                    <User className="input-icon" />
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="Enter first name"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <div className="input-group">
                    <User className="input-icon" />
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Enter last name"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-group">
                <Mail className="input-icon" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter email address"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-group">
                <Lock className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            {error && (
              <div className="error-message">
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-full" disabled={!!loading}>
              {loading ? (
                <div className="loading"></div>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>


          <div className="auth-footer">
            <p>
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                className="link-btn"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
            <p>
              <button
                type="button"
                className="link-btn"
                onClick={() => window.location.href = '/register'}
              >
                Apply for Manufacturer/Vendor Account
              </button>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%);
        }

        .auth-card {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-green);
          border-radius: 1rem;
          padding: 2rem;
          backdrop-filter: blur(10px);
          max-width: 450px;
          width: 100%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .auth-header .logo h1 {
          font-size: 2rem;
          font-weight: 700;
          background: linear-gradient(135deg, var(--light-green) 0%, var(--primary-green) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.5rem;
        }

        .auth-header .logo p {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .auth-form h2 {
          color: var(--text-primary);
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .input-group {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 1rem;
          width: 1.25rem;
          height: 1.25rem;
          color: var(--text-secondary);
        }

        .input-group input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-green);
          border-radius: 0.5rem;
          color: var(--text-primary);
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        .input-group input:focus {
          outline: none;
          border-color: var(--primary-green);
          background: rgba(255, 255, 255, 0.1);
        }

        .input-group input::placeholder {
          color: var(--text-secondary);
          opacity: 0.6;
        }

        .password-toggle {
          position: absolute;
          right: 1rem;
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 0.25rem;
          transition: color 0.3s ease;
        }

        .password-toggle:hover {
          color: var(--text-primary);
        }

        .password-toggle svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid var(--error);
          border-radius: 0.5rem;
          padding: 0.75rem;
          margin-bottom: 1.5rem;
          color: var(--error);
          text-align: center;
          font-size: 0.9rem;
        }

        .btn-full {
          width: 100%;
          justify-content: center;
          outline: none;
          border: none;
        }

        .btn-google {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: var(--text-primary);
        }

        .btn-google:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        .auth-divider {
          text-align: center;
          margin: 1.5rem 0;
          position: relative;
        }

        .auth-divider::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--border-green);
        }

        .auth-divider span {
          background: rgba(6, 78, 59, 0.95);
          padding: 0 1rem;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .auth-footer {
          text-align: center;
          margin-top: 1.5rem;
        }

        .auth-footer p {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .link-btn {
          background: none;
          border: none;
          color: var(--accent-green);
          cursor: pointer;
          font-weight: 600;
          margin-left: 0.5rem;
          transition: color 0.3s ease;
        }

        .link-btn:hover {
          color: var(--light-green);
        }

        @media (max-width: 480px) {
          .form-row {
            grid-template-columns: 1fr;
          }
          
          .auth-card {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  )
}

export default Login
