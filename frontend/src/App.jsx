import { Routes, Route, Link, Navigate } from 'react-router-dom'
import { Scan, Shield, Activity, Users, Package, AlertTriangle, Building } from 'lucide-react'
import './styles.css'

// Components
import QRScanner from './components/QRScanner'
import VerificationResult from './components/VerificationResult'
import Dashboard from './components/Dashboard'
import Header from './components/Header'
import Login from './components/Login'
import ManufacturerDashboard from './components/ManufacturerDashboard'
import AdminDashboard from './components/AdminDashboard'
import Registration from './components/Registration'
import ProtectedRoute from './components/ProtectedRoute'
import ApplicationForm from './components/ApplicationForm'
import ApplicationReview from './components/ApplicationReview'
import { AuthProvider } from './contexts/AuthProvider'
import { useAuth } from './hooks/useAuth'

function AppContent() {
  const { isAuthenticated, loading, user } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading PharmaTrace...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="particles-container">
        <div className="particles-placeholder"></div>
      </div>
      
      <div className="content">
        {isAuthenticated && <Header />}
        
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/scan"
            element={
              isAuthenticated && user?.role === 'manufacturer'
                ? <Navigate to="/manufacturer" replace />
                : <QRScanner />
            }
          />
          <Route path="/result" element={<VerificationResult />} />
          <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Login />} />
          
          {/* Application Forms */}
          <Route path="/apply/vendor" element={<ApplicationForm role="vendor" />} />
          <Route path="/apply/manufacturer" element={<ApplicationForm role="manufacturer" />} />
          
          {/* Role-based routes */}
          <Route path="/manufacturer" element={
            <ProtectedRoute requiredRole="manufacturer">
              <ManufacturerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/applications" element={
            <ProtectedRoute requiredRole="admin">
              <ApplicationReview />
            </ProtectedRoute>
          } />
          <Route path="/register" element={<Registration />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

function Home() {
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="home">
      <div className="hero">
        <div className="hero-content">
          <div className="logo">
            <Shield className="logo-icon" />
            <h1>PharmaTrace</h1>
          </div>
          <p className="tagline">Authentic Medicine Verification System</p>
          <p className="description">
            Scan QR codes to verify medicine authenticity and track pharmaceutical supply chain
          </p>
          
          <div className="features">
            <div className="feature">
              <Scan className="feature-icon" />
              <h3>QR Scanning</h3>
              <p>Instant medicine verification</p>
            </div>
            <div className="feature">
              <Activity className="feature-icon" />
              <h3>Real-time Detection</h3>
              <p>Identify counterfeit medicines</p>
            </div>
            <div className="feature">
              <Users className="feature-icon" />
              <h3>Supply Chain Tracking</h3>
              <p>Complete authentication journey</p>
            </div>
            <div className="feature">
              <AlertTriangle className="feature-icon" />
              <h3>Fraud Detection</h3>
              <p>Advanced anomaly detection</p>
            </div>
          </div>
          
          <div className="cta-buttons">
            {isAuthenticated ? (
              user?.role === 'manufacturer' ? (
                <Link to="/manufacturer" className="btn btn-primary">
                  <Building className="btn-icon" />
                  Open Manufacturer Portal
                </Link>
              ) : (
                <Link to="/scan" className="btn btn-primary">
                  <Scan className="btn-icon" />
                  Start Scanning
                </Link>
              )
            ) : (
              <>
                <Link to="/login" className="btn btn-primary">
                  <Scan className="btn-icon" />
                  Get Started
                </Link>
                <Link to="/login" className="btn btn-secondary">
                  <Package className="btn-icon" />
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
