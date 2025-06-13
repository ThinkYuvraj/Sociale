import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Initialize socket connection
      const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000', {
        auth: {
          token: localStorage.getItem('token')
        }
      });

      setSocket(newSocket);

      // Handle connection events
      newSocket.on('connect', () => {
        console.log('Connected to server');
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
      });

      // Handle user status updates
      newSocket.on('user-online', (data) => {
        setOnlineUsers(prev => [...prev.filter(id => id !== data.userId), data.userId]);
      });

      newSocket.on('user-offline', (data) => {
        setOnlineUsers(prev => prev.filter(id => id !== data.userId));
      });

      // Handle notifications
      newSocket.on('post-liked', (data) => {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'like',
          message: `${data.username} liked your post`,
          timestamp: new Date(),
          read: false
        }]);
      });

      newSocket.on('post-commented', (data) => {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'comment',
          message: `${data.username} commented on your post`,
          timestamp: new Date(),
          read: false
        }]);
      });

      newSocket.on('user-followed', (data) => {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'follow',
          message: `${data.username} started following you`,
          timestamp: new Date(),
          read: false
        }]);
      });

      // Handle errors
      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      return () => {
        newSocket.close();
      };
    }
  }, [user]);

  const joinChat = (chatId) => {
    if (socket) {
      socket.emit('join-chat', chatId);
    }
  };

  const leaveChat = (chatId) => {
    if (socket) {
      socket.emit('leave-chat', chatId);
    }
  };

  const sendMessage = (chatId, content, messageType = 'text') => {
    if (socket) {
      socket.emit('send-message', {
        chatId,
        content,
        messageType
      });
    }
  };

  const startTyping = (chatId) => {
    if (socket) {
      socket.emit('typing-start', { chatId });
    }
  };

  const stopTyping = (chatId) => {
    if (socket) {
      socket.emit('typing-stop', { chatId });
    }
  };

  const markMessagesRead = (chatId) => {
    if (socket) {
      socket.emit('mark-messages-read', { chatId });
    }
  };

  const likePost = (postId, authorId, isLiked) => {
    if (socket) {
      socket.emit('like-post', { postId, authorId, isLiked });
    }
  };

  const commentPost = (postId, authorId, comment) => {
    if (socket) {
      socket.emit('comment-post', { postId, authorId, comment });
    }
  };

  const followUser = (userId, isFollowing) => {
    if (socket) {
      socket.emit('follow-user', { userId, isFollowing });
    }
  };

  const markNotificationRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, read: true }
          : notif
      )
    );
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const value = {
    socket,
    onlineUsers,
    notifications,
    joinChat,
    leaveChat,
    sendMessage,
    startTyping,
    stopTyping,
    markMessagesRead,
    likePost,
    commentPost,
    followUser,
    markNotificationRead,
    clearNotifications
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};