// Mock authentication service for testing without database
export const mockUsers = [
  {
    id: 1,
    email: 'admin@pharmatrace.com',
    password: 'Admin@123456',
    role: 'admin',
    firstName: 'Admin',
    lastName: 'User'
  },
  {
    id: 2,
    email: 'manufacturer@pharmatrace.com',
    password: 'Mfg@123456',
    role: 'manufacturer',
    firstName: 'John',
    lastName: 'Smith'
  },
  {
    id: 3,
    email: 'vendor@pharmatrace.com',
    password: 'Vendor@123456',
    role: 'vendor',
    firstName: 'Jane',
    lastName: 'Doe'
  }
]

export const mockLogin = (email, password) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const user = mockUsers.find(u => u.email === email && u.password === password)
      
      if (user) {
        resolve({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName
          },
          token: `mock-token-${user.id}-${Date.now()}`
        })
      } else {
        reject({
          success: false,
          error: 'Invalid email or password'
        })
      }
    }, 500) // Simulate network delay
  })
}

export const mockVerifyToken = (token) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Extract user ID from mock token
      const userId = token.split('-')[1]
      const user = mockUsers.find(u => u.id == userId)
      
      if (user) {
        resolve({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName
          }
        })
      } else {
        resolve({ success: false })
      }
    }, 200)
  })
}
