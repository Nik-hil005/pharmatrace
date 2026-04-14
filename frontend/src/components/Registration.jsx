import { useState } from 'react'
import { Building, Package, Mail, Phone, FileText, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function Registration() {
  const [formData, setFormData] = useState({
    type: 'MANUFACTURER',
    companyName: '',
    email: '',
    phone: '',
    address: '',
    licenseNumber: '',
    description: '',
    firstName: '',
    lastName: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Mock API call for registration request
      const response = await fetch('/api/registration/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        alert('Registration request submitted successfully! Please wait for admin approval.')
        navigate('/login')
      } else {
        setError(data.error || 'Registration failed')
      }
    } catch (err) {
      console.error('Registration error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="registration-container">
      <div className="registration-card">
        <div className="registration-header">
          <h1>Apply for Account</h1>
          <p>Register your company for PharmaTrace access</p>
        </div>

        <form onSubmit={handleSubmit} className="registration-form">
          {/* Account Type Selection */}
          <div className="form-group">
            <label>Account Type</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="type"
                  value="MANUFACTURER"
                  checked={formData.type === 'MANUFACTURER'}
                  onChange={handleChange}
                />
                <Building className="radio-icon" />
                <span>Manufacturer</span>
                <p className="radio-description">Create and manage medicine batches</p>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="type"
                  value="VENDOR"
                  checked={formData.type === 'VENDOR'}
                  onChange={handleChange}
                />
                <Package className="radio-icon" />
                <span>Vendor</span>
                <p className="radio-description">Receive and activate medicine batches</p>
              </label>
            </div>
          </div>

          {/* User Information */}
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

          {/* Company Information */}
          <div className="form-group">
            <label htmlFor="companyName">Company Name</label>
            <div className="input-group">
              <Building className="input-icon" />
              <input
                type="text"
                id="companyName"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder="Enter company name"
                required
              />
            </div>
          </div>

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
            <label htmlFor="phone">Phone Number</label>
            <div className="input-group">
              <Phone className="input-icon" />
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="address">Address</label>
            <div className="input-group">
              <FileText className="input-icon" />
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter company address"
                rows={3}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="licenseNumber">
              License Number
            </label>
            <div className="input-group">
              <FileText className="input-icon" />
              <input
                type="text"
                id="licenseNumber"
                name="licenseNumber"
                value={formData.licenseNumber}
                onChange={handleChange}
                placeholder={`Enter ${formData.type === 'MANUFACTURER' ? 'pharmaceutical' : 'vendor'} license number`}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <div className="input-group">
              <FileText className="input-icon" />
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Tell us about your company"
                rows={4}
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? (
              <div className="loading"></div>
            ) : (
              'Submit Application'
            )}
          </button>
        </form>

        <div className="registration-footer">
          <p>
            Already have an account?
            <button
              type="button"
              className="link-btn"
              onClick={() => navigate('/login')}
            >
              Sign In
            </button>
          </p>
        </div>
      </div>

      <style jsx>{`
        .registration-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%);
        }

        .registration-card {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-green);
          border-radius: 1rem;
          padding: 2rem;
          backdrop-filter: blur(10px);
          max-width: 600px;
          width: 100%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .registration-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .registration-header h1 {
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }

        .registration-header p {
          color: var(--text-secondary);
          font-size: 1.1rem;
        }

        .registration-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          color: var(--text-secondary);
          font-weight: 500;
          font-size: 0.9rem;
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

        .input-group input,
        .input-group textarea {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-green);
          border-radius: 0.5rem;
          color: var(--text-primary);
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        .input-group input:focus,
        .input-group textarea:focus {
          outline: none;
          border-color: var(--primary-green);
          background: rgba(255, 255, 255, 0.1);
        }

        .input-group input::placeholder,
        .input-group textarea::placeholder {
          color: var(--text-secondary);
          opacity: 0.6;
        }

        .radio-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .radio-option {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          border: 2px solid var(--border-green);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .radio-option:hover {
          border-color: var(--primary-green);
          background: rgba(16, 185, 129, 0.05);
        }

        .radio-option input[type="radio"] {
          margin: 0;
        }

        .radio-option input[type="radio"]:checked + .radio-icon {
          color: var(--primary-green);
        }

        .radio-icon {
          width: 1.5rem;
          height: 1.5rem;
          flex-shrink: 0;
        }

        .radio-option span {
          font-weight: 600;
          color: var(--text-primary);
        }

        .radio-description {
          margin: 0.25rem 0 0 0;
          font-size: 0.875rem;
          color: var(--text-secondary);
          line-height: 1.4;
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

        .registration-footer {
          text-align: center;
          margin-top: 1.5rem;
        }

        .registration-footer p {
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

        @media (max-width: 768px) {
          .registration-container {
            padding: 1rem;
          }

          .registration-card {
            padding: 1.5rem;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .radio-group {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

export default Registration
