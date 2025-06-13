import React, { useState } from 'react';
import { Navbar, Nav, Container, Dropdown, Badge, Form, FormControl } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

const NavigationBar = () => {
  const { user, logout } = useAuth();
  const { notifications } = useSocket();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  const unreadNotifications = notifications.filter(notif => !notif.read).length;

  return (
    <Navbar bg="white" expand="lg" className="shadow-sm sticky-top">
      <Container>
        <Navbar.Brand as={Link} to="/" className="fw-bold">
          <i className="fas fa-share-alt me-2"></i>
          Sociale
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        
        <Navbar.Collapse id="basic-navbar-nav">
          {/* Search Bar */}
          <Form className="d-flex mx-auto" style={{ maxWidth: '400px' }} onSubmit={handleSearch}>
            <FormControl
              type="search"
              placeholder="Search users, posts..."
              className="me-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Form>

          <Nav className="ms-auto align-items-center">
            {/* Navigation Links */}
            <Nav.Link as={Link} to="/" className="px-3">
              <i className="fas fa-home fa-lg"></i>
            </Nav.Link>
            
            <Nav.Link as={Link} to="/explore" className="px-3">
              <i className="fas fa-compass fa-lg"></i>
            </Nav.Link>
            
            <Nav.Link as={Link} to="/chat" className="px-3 position-relative">
              <i className="fas fa-comment fa-lg"></i>
            </Nav.Link>
            
            <Nav.Link as={Link} to="/stories" className="px-3">
              <i className="fas fa-plus-circle fa-lg"></i>
            </Nav.Link>

            {/* Notifications */}
            <Dropdown align="end" className="px-2">
              <Dropdown.Toggle variant="link" className="text-decoration-none text-dark position-relative p-2">
                <i className="fas fa-bell fa-lg"></i>
                {unreadNotifications > 0 && (
                  <Badge bg="danger" className="notification-badge">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </Badge>
                )}
              </Dropdown.Toggle>

              <Dropdown.Menu style={{ width: '300px', maxHeight: '400px', overflowY: 'auto' }}>
                <Dropdown.Header>Notifications</Dropdown.Header>
                {notifications.length === 0 ? (
                  <Dropdown.Item disabled>No notifications</Dropdown.Item>
                ) : (
                  notifications.slice(0, 10).map((notification) => (
                    <Dropdown.Item
                      key={notification.id}
                      className={`${!notification.read ? 'bg-light' : ''} py-2`}
                    >
                      <div className="d-flex align-items-center">
                        <i className={`fas ${
                          notification.type === 'like' ? 'fa-heart text-danger' :
                          notification.type === 'comment' ? 'fa-comment text-primary' :
                          'fa-user-plus text-success'
                        } me-2`}></i>
                        <div className="flex-grow-1">
                          <small className="text-muted d-block">
                            {notification.message}
                          </small>
                          <small className="text-muted">
                            {new Date(notification.timestamp).toLocaleTimeString()}
                          </small>
                        </div>
                      </div>
                    </Dropdown.Item>
                  ))
                )}
              </Dropdown.Menu>
            </Dropdown>

            {/* User Menu */}
            <Dropdown align="end">
              <Dropdown.Toggle variant="link" className="text-decoration-none p-0">
                <img
                  src={user?.profilePicture || `https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=1877f2&color=fff`}
                  alt="Profile"
                  className="avatar"
                />
              </Dropdown.Toggle>

              <Dropdown.Menu>
                <Dropdown.Item as={Link} to={`/profile/${user?.id}`}>
                  <i className="fas fa-user me-2"></i>
                  Profile
                </Dropdown.Item>
                <Dropdown.Item as={Link} to="/settings">
                  <i className="fas fa-cog me-2"></i>
                  Settings
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>
                  <i className="fas fa-sign-out-alt me-2"></i>
                  Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default NavigationBar;