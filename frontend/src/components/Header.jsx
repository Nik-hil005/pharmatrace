import { Link } from 'react-router-dom'
import { Shield, Menu, X, LogOut, User, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const { user, logout } = useAuth()

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const handleLogout = async () => {
    await logout()
    setIsProfileOpen(false)
  }

  return (
    <header>
      <div className="header-content">
        <Link to="/" className="logo">
          <Shield className="logo-icon" />
          <h1>PharmaTrace</h1>
        </Link>

        <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <ul className={isMenuOpen ? 'nav-open' : ''} style={{ display: 'flex', listStyle: 'none', margin: 0, padding: 0, alignItems: 'center' }}>
            <li><Link to="/" onClick={() => setIsMenuOpen(false)}>Home</Link></li>
            <li><Link to="/scan" onClick={() => setIsMenuOpen(false)}>Scan</Link></li>
            <li><Link to="/dashboard" onClick={() => setIsMenuOpen(false)}>Dashboard</Link></li>
            
            {/* Role-based navigation */}
            {user?.role === 'manufacturer' && (
              <li><Link to="/manufacturer" onClick={() => setIsMenuOpen(false)}>Manufacturer Portal</Link></li>
            )}
            {user?.role === 'vendor' && (
              <li><Link to="/vendor" onClick={() => setIsMenuOpen(false)}>Vendor Portal</Link></li>
            )}
            {user?.role === 'admin' && (
              <li><Link to="/admin" onClick={() => setIsMenuOpen(false)}>Admin Portal</Link></li>
            )}
            {user?.role === 'regulator' && (
              <li><Link to="/regulator" onClick={() => setIsMenuOpen(false)}>Regulator Portal</Link></li>
            )}
          </ul>
          
          <div className="header-actions">
            <div className="profile-dropdown">
              <button 
                className="profile-btn"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
              >
                <User className="profile-icon" />
                <span>{user?.firstName || user?.email}</span>
              </button>
              
              {isProfileOpen && (
                <div className="profile-menu">
                  <div className="profile-menu">
                    <p className="profile-name">{user?.firstName} {user?.lastName}</p>
                    <p className="profile-email">{user?.email}</p>
                    <p className="profile-role">{user?.role}</p>
                  </div>
                  <div className="profile-divider"></div>
                  <button className="profile-logout" onClick={handleLogout}>
                    <LogOut className="logout-icon" />
                    Sign Out
                  </button>
                  <button className="profile-delete" onClick={() => {
                    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                      // Handle account deletion
                      alert('Account deletion requested - this would need to be implemented')
                    }
                  }}>
                    <Trash2 className="logout-icon" />
                    Delete Account
                  </button>
                </div>
              )}
            </div>
            
            <button className="mobile-menu-btn" onClick={toggleMenu}>
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </nav>
      </div>

      <style jsx>{`
        .header-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .profile-dropdown {
          position: relative;
        }

        .profile-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--border-green);
          border-radius: 0.5rem;
          padding: 0.5rem 1rem;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 0.9rem;
        }

        .profile-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .profile-icon {
          width: 1.25rem;
          height: 1.25rem;
        }

        .profile-menu {
          position: absolute;
          top: 100%;
          right: 0;
          background: rgba(2, 44, 34, 0.98);
          backdrop-filter: blur(10px);
          border: 1px solid var(--border-green);
          border-radius: 0.5rem;
          padding: 1rem;
          min-width: 200px;
          margin-top: 0.5rem;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          z-index: 1000;
        }

        .profile-logout {
          background: rgba(239, 68, 68, 0.1);
          color: var(--error);
          border: 1px solid var(--error);
          border-radius: 0.5rem;
          padding: 0.5rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .profile-delete {
          background: rgba(249, 115, 22, 0.1);
          color: var(--text-primary);
          border: 1px solid var(--error);
          border-radius: 0.5rem;
          padding: 0.5rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .profile-delete:hover {
          background: rgba(220, 53, 69, 0.2);
        }

        .profile-info {
          margin-bottom: 1rem;
        }

        .profile-name {
          color: var(--text-primary);
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .profile-email {
          color: var(--text-secondary);
          font-size: 0.8rem;
          margin-bottom: 0.25rem;
          word-break: break-all;
        }

        .profile-role {
          color: var(--accent-green);
          font-size: 0.8rem;
          text-transform: uppercase;
          font-weight: 600;
        }

        .profile-divider {
          height: 1px;
          background: var(--border-green);
          margin: 1rem 0;
        }

        .profile-logout {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          background: none;
          border: none;
          color: var(--error);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.25rem;
          transition: background-color 0.3s ease;
          font-size: 0.9rem;
        }

        .profile-logout:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .logout-icon {
          width: 1rem;
          height: 1rem;
        }

        .mobile-menu-btn {
          display: none;
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          padding: 0.5rem;
        }

        /* Desktop Navigation Styles */
        nav ul:not(.nav-open) {
          display: flex !important;
          list-style: none;
          margin: 0;
          padding: 0;
          align-items: center;
        }

        nav ul:not(.nav-open) li {
          margin-left: 1.5rem;
          width: auto !important;
        }

        nav ul:not(.nav-open) li a {
          color: var(--text-secondary);
          text-decoration: none;
          font-weight: 500;
          transition: color 0.3s ease;
          padding: 0.5rem 0;
          display: inline !important;
        }

        nav ul:not(.nav-open) li a:hover {
          color: var(--primary-green);
        }

        @media (max-width: 768px) {
          .header-actions {
            gap: 0.5rem;
          }

          .profile-btn span {
            display: none;
          }

          .mobile-menu-btn {
            display: block;
          }

          nav ul {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: rgba(2, 44, 34, 0.98);
            backdrop-filter: blur(10px);
            flex-direction: column;
            padding: 1rem;
            gap: 0;
            transform: translateY(-100%);
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
            border-top: 1px solid var(--border-green);
          }

          nav ul.nav-open {
            transform: translateY(0);
            opacity: 1;
            visibility: visible;
          }

          nav ul li {
            width: 100%;
          }

          nav ul a {
            display: block;
            padding: 1rem;
            border-radius: 0;
          }

          .profile-menu {
            right: 0;
            left: auto;
            min-width: 150px;
          }
        }
      `}</style>
    </header>
  )
}

export default Header
