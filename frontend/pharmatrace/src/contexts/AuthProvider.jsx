import React, { useState, useEffect } from 'react'
import { authEndpoints, storageKeys } from '../utils/auth'
import { AuthContext } from './AuthContext'
import { mockLogin, mockVerifyToken } from '../services/mockAuth'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(localStorage.getItem(storageKeys.token))

  useEffect(() => {
    const initAuth = async () => {
      // Check for mock authentication first
      const mockToken = localStorage.getItem('authToken')
      const mockUser = localStorage.getItem('user')
      
      if (mockToken && mockUser) {
        try {
          const user = JSON.parse(mockUser)
          setUser(user)
          setToken(mockToken)
          setLoading(false)
          return
        } catch (error) {
          console.error('Error parsing mock user data:', error)
          localStorage.removeItem('authToken')
          localStorage.removeItem('user')
        }
      }
      
      // Original token verification logic
      if (token) {
        try {
          // Try backend first, fallback to mock
          let response
          try {
            response = await fetch(authEndpoints.verify, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
          } catch (networkError) {
            // Backend not available, use mock
            const mockResult = await mockVerifyToken(token)
            if (mockResult.success) {
              setUser(mockResult.user)
            } else {
              localStorage.removeItem(storageKeys.token)
              setToken(null)
            }
            setLoading(false)
            return
          }

          if (response.ok) {
            const data = await response.json()
            setUser(data.user)
          } else {
            // Token invalid, remove it
            localStorage.removeItem(storageKeys.token)
            setToken(null)
          }
        } catch (err) {
          console.error('Token verification failed:', err)
          localStorage.removeItem(storageKeys.token)
          setToken(null)
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [token])

  const login = async (email, password) => {
    try {
      // Try backend first, fallback to mock
      let response
      try {
        response = await fetch(authEndpoints.login, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        })
      } catch (networkError) {
        // Backend not available, use mock
        const mockResult = await mockLogin(email, password)
        if (mockResult.success) {
          setToken(mockResult.token)
          setUser(mockResult.user)
          localStorage.setItem(storageKeys.token, mockResult.token)
          return mockResult
        } else {
          throw new Error(mockResult.error)
        }
      }

      if (response.ok) {
        const data = await response.json()
        setToken(data.token)
        setUser(data.user)
        localStorage.setItem(storageKeys.token, data.token)
        return data
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Login failed')
      }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const register = async (userData) => {
    try {
      const response = await fetch(authEndpoints.register, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      const data = await response.json()

      if (response.ok) {
        setUser(data.user)
        setToken(data.token)
        localStorage.setItem(storageKeys.token, data.token)
        return { success: true, user: data.user }
      } else {
        return { success: false, error: data.error }
      }
    } catch (err) {
      console.error('Registration error:', err)
      return { success: false, error: 'Registration failed' }
    }
  }

  const googleLogin = async (googleData) => {
    try {
      const response = await fetch(authEndpoints.googleCallback, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(googleData)
      })

      const data = await response.json()

      if (response.ok) {
        setUser(data.user)
        setToken(data.token)
        localStorage.setItem(storageKeys.token, data.token)
        return { success: true, user: data.user }
      } else {
        return { success: false, error: data.error }
      }
    } catch (err) {
      console.error('Google login error:', err)
      return { success: false, error: 'Google login failed' }
    }
  }

  const logout = async () => {
    try {
      if (token) {
        await fetch(authEndpoints.logout, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      }
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      // Clear both regular and mock authentication data
      setUser(null)
      setToken(null)
      localStorage.removeItem(storageKeys.token)
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
    }
  }

  const value = {
    user,
    token,
    loading,
    login,
    register,
    googleLogin,
    logout,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
