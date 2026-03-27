// Authentication utilities
export const API_BASE_URL = 'http://localhost:5000'

export const authEndpoints = {
  verify: `${API_BASE_URL}/api/auth/verify`,
  login: `${API_BASE_URL}/api/auth/login`,
  register: `${API_BASE_URL}/api/auth/register`,
  logout: `${API_BASE_URL}/api/auth/logout`,
  profile: `${API_BASE_URL}/api/auth/profile`
}

export const storageKeys = {
  token: 'pharmatrace_token'
}

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export const validatePassword = (password) => {
  return password.length >= 6
}

export const generateTokenHash = async (token) => {
  // This would be done on the backend, but for frontend reference
  return token.substring(0, 10) + '...'
}
