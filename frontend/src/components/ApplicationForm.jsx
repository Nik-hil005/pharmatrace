import { useState } from 'react'
import { Building, User, Phone, Mail, FileText, AlertCircle, CheckCircle, MapPin, Lock } from 'lucide-react'
import './ApplicationForm.css'

function validatePasswordRules(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number'
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one special character'
  }
  return null
}

function ApplicationForm({ role }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    licenseNumber: '',
    city: '',
    address: '',
    description: '',
    password: ''
  })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
    setSuccess('')
  }

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      setError('Full name is required')
      return false
    }
    if (!formData.email.trim()) {
      setError('Email is required')
      return false
    }
    if (!formData.email.includes('@')) {
      setError('Valid email is required')
      return false
    }
    if (!formData.companyName.trim()) {
      setError('Company name is required')
      return false
    }
    if (!formData.licenseNumber.trim()) {
      setError('License number is required')
      return false
    }
    if (role === 'vendor') {
      const cityTrimmed = formData.city.trim()
      if (!cityTrimmed) {
        setError('City is required')
        return false
      }
      if (cityTrimmed.length < 2) {
        setError('City must be at least 2 characters')
        return false
      }
      if (!/^[A-Za-z\s-]+$/.test(cityTrimmed)) {
        setError('City may only contain letters, spaces, and hyphens')
        return false
      }
    }
    const pwdErr = validatePasswordRules(formData.password)
    if (pwdErr) {
      setError(pwdErr)
      return false
    }
    if (formData.password !== confirmPassword) {
      setError('Passwords do not match')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || null,
          companyName: formData.companyName.trim(),
          licenseNumber: formData.licenseNumber.trim(),
          address: formData.address.trim() || null,
          description: formData.description.trim() || null,
          city: role === 'vendor' ? formData.city.trim() : null,
          role,
          password: formData.password
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess('Your application has been submitted and is under review.')
        setFormData({
          fullName: '',
          email: '',
          phone: '',
          companyName: '',
          licenseNumber: '',
          city: '',
          address: '',
          description: '',
          password: ''
        })
        setConfirmPassword('')
      } else {
        setError(result.error || 'Failed to submit application')
      }
    } catch (err) {
      console.error('Application submission error:', err)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="application-form-root">
      <div className="form-header">
        <Building className="form-icon" />
        <h1>{role === 'vendor' ? 'Vendor' : 'Manufacturer'} Registration Application</h1>
        <p>Apply to become a registered {role} on PharmaTrace</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle className="alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircle className="alert-icon" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="registration-form" noValidate>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="fullName">Full Name *</label>
            <User className="input-icon" />
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter your full name"
              autoComplete="name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <Mail className="input-icon" />
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email address"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <Phone className="input-icon" />
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter your phone number"
              autoComplete="tel"
            />
          </div>

          <div className="form-group">
            <label htmlFor="companyName">Company Name *</label>
            <Building className="input-icon" />
            <input
              type="text"
              id="companyName"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              placeholder="Enter your company name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="licenseNumber">License Number *</label>
            <FileText className="input-icon" />
            <input
              type="text"
              id="licenseNumber"
              name="licenseNumber"
              value={formData.licenseNumber}
              onChange={handleChange}
              placeholder={`Enter your ${role} license number`}
              required
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="address">Business Address</label>
            <Building className="input-icon" />
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter your business address"
              rows={3}
            />
          </div>

          {role === 'vendor' && (
            <div className="form-group full-width">
              <label htmlFor="city">City *</label>
              <MapPin className="input-icon" />
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Enter your city"
                autoComplete="address-level2"
                required
              />
            </div>
          )}

          <div className="form-group full-width">
            <label htmlFor="description">Business Description</label>
            <FileText className="input-icon" />
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder={`Describe your ${role} business and operations`}
              rows={4}
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="password">Create Password *</label>
            <Lock className="input-icon" />
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a strong password"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <Lock className="input-icon" />
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setError('')
                setSuccess('')
              }}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              required
            />
            {confirmPassword.length > 0 && formData.password !== confirmPassword && (
              <div className="field-error">Passwords do not match</div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Submitting...' : `Submit ${role} Application`}
          </button>
        </div>
      </form>

      <div className="form-footer">
        <p>
          <strong>Note:</strong> After submission, your application will be reviewed by our admin team. You will
          receive an email notification once a decision has been made.
        </p>
      </div>
    </div>
  )
}

export default ApplicationForm
