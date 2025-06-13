const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Chat = require('../models/Chat');

const socketHandler = (io) => {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User ${socket.user.username} connected`);

    // Update user online status
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: new Date()
    });

    // Join user to their personal room
    socket.join(socket.userId);

    // Join user to their chat rooms
    const userChats = await Chat.find({
      participants: socket.userId,
      isActive: true
    });

    userChats.forEach(chat => {
      socket.join(chat._id.toString());
    });

    // Handle joining a chat room
    socket.on('join-chat', (chatId) => {
      socket.join(chatId);
      console.log(`User ${socket.user.username} joined chat ${chatId}`);
    });

    // Handle leaving a chat room
    socket.on('leave-chat', (chatId) => {
      socket.leave(chatId);
      console.log(`User ${socket.user.username} left chat ${chatId}`);
    });

    // Handle sending a message
    socket.on('send-message', async (data) => {
      try {
        const { chatId, content, messageType = 'text' } = data;
        
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.userId)) {
          return socket.emit('error', { message: 'Chat not found or unauthorized' });
        }

        const message = {
          sender: socket.userId,
          content,
          messageType,
          createdAt: new Date()
        };

        chat.messages.push(message);
        chat.lastMessage = {
          content,
          sender: socket.userId,
          timestamp: new Date()
        };

        await chat.save();
        await chat.populate('messages.sender', 'username firstName lastName profilePicture');

        const newMessage = chat.messages[chat.messages.length - 1];

        // Emit to all participants in the chat
        io.to(chatId).emit('new-message', {
          chatId,
          message: newMessage
        });

        // Send push notification to offline users
        const offlineParticipants = await User.find({
          _id: { $in: chat.participants },
          isOnline: false
        });

        // Here you would implement push notifications for offline users
        
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing-start', (data) => {
      const { chatId } = data;
      socket.to(chatId).emit('user-typing', {
        userId: socket.userId,
        username: socket.user.username,
        isTyping: true
      });
    });

    socket.on('typing-stop', (data) => {
      const { chatId } = data;
      socket.to(chatId).emit('user-typing', {
        userId: socket.userId,
        username: socket.user.username,
        isTyping: false
      });
    });

    // Handle message read receipts
    socket.on('mark-messages-read', async (data) => {
      try {
        const { chatId } = data;
        
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.userId)) {
          return;
        }

        // Mark messages as read
        chat.messages.forEach(message => {
          if (message.sender.toString() !== socket.userId) {
            const hasRead = message.readBy.some(read => 
              read.user.toString() === socket.userId
            );
            
            if (!hasRead) {
              message.readBy.push({
                user: socket.userId,
                readAt: new Date()
              });
            }
          }
        });

        await chat.save();

        // Notify other participants
        socket.to(chatId).emit('messages-read', {
          chatId,
          userId: socket.userId,
          readAt: new Date()
        });

      } catch (error) {
        console.error('Mark messages read error:', error);
      }
    });

    // Handle real-time post interactions
    socket.on('like-post', (data) => {
      const { postId, authorId, isLiked } = data;
      
      // Notify post author
      socket.to(authorId).emit('post-liked', {
        postId,
        userId: socket.userId,
        username: socket.user.username,
        isLiked
      });
    });

    socket.on('comment-post', (data) => {
      const { postId, authorId, comment } = data;
      
      // Notify post author
      socket.to(authorId).emit('post-commented', {
        postId,
        userId: socket.userId,
        username: socket.user.username,
        comment
      });
    });

    // Handle follow notifications
    socket.on('follow-user', (data) => {
      const { userId, isFollowing } = data;
      
      socket.to(userId).emit('user-followed', {
        userId: socket.userId,
        username: socket.user.username,
        profilePicture: socket.user.profilePicture,
        isFollowing
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.username} disconnected`);
      
      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date()
      });

      // Notify contacts about offline status
      socket.broadcast.emit('user-offline', {
        userId: socket.userId
      });
    });
  });
};

module.exports = socketHandler;