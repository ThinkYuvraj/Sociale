const express = require('express');
const Chat = require('../models/Chat');
const User = require('../models/User');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Get user's chats
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.userId,
      isActive: true
    })
    .populate('participants', 'username firstName lastName profilePicture isOnline lastSeen')
    .populate('lastMessage.sender', 'username firstName lastName profilePicture')
    .sort({ 'lastMessage.timestamp': -1 });

    res.json({ chats });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create or get existing chat
router.post('/create', auth, async (req, res) => {
  try {
    const { participantId, chatType = 'private' } = req.body;

    if (chatType === 'private') {
      // Check if chat already exists between these users
      let chat = await Chat.findOne({
        chatType: 'private',
        participants: { $all: [req.userId, participantId], $size: 2 }
      })
      .populate('participants', 'username firstName lastName profilePicture isOnline lastSeen');

      if (chat) {
        return res.json({ chat });
      }

      // Create new private chat
      chat = new Chat({
        participants: [req.userId, participantId],
        chatType: 'private'
      });

      await chat.save();
      await chat.populate('participants', 'username firstName lastName profilePicture isOnline lastSeen');

      res.status(201).json({
        message: 'Chat created successfully',
        chat
      });
    } else {
      // Group chat creation logic would go here
      res.status(400).json({ message: 'Group chat creation not implemented yet' });
    }
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get chat messages
router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const chat = await Chat.findById(req.params.chatId)
      .populate('messages.sender', 'username firstName lastName profilePicture')
      .populate('messages.readBy.user', 'username firstName lastName profilePicture');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.userId)) {
      return res.status(403).json({ message: 'Not authorized to access this chat' });
    }

    // Get paginated messages
    const messages = chat.messages
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(skip, skip + limit)
      .reverse();

    res.json({
      messages,
      currentPage: page,
      hasMore: chat.messages.length > skip + limit
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message
router.post('/:chatId/message', auth, upload.single('media'), async (req, res) => {
  try {
    const { content, messageType = 'text' } = req.body;
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.userId)) {
      return res.status(403).json({ message: 'Not authorized to send message to this chat' });
    }

    const message = {
      sender: req.userId,
      content: content || '',
      messageType,
      createdAt: new Date()
    };

    // Handle media upload
    if (req.file) {
      message.media = {
        url: req.file.secure_url,
        publicId: req.file.public_id,
        fileName: req.file.original_filename,
        fileSize: req.file.bytes
      };
      message.messageType = req.file.resource_type;
    }

    chat.messages.push(message);
    
    // Update last message
    chat.lastMessage = {
      content: message.content || `Sent a ${message.messageType}`,
      sender: req.userId,
      timestamp: new Date()
    };

    await chat.save();

    // Populate the new message
    await chat.populate('messages.sender', 'username firstName lastName profilePicture');
    
    const newMessage = chat.messages[chat.messages.length - 1];

    res.status(201).json({
      message: 'Message sent successfully',
      messageData: newMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark messages as read
router.post('/:chatId/read', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.userId)) {
      return res.status(403).json({ message: 'Not authorized to access this chat' });
    }

    // Mark unread messages as read
    chat.messages.forEach(message => {
      if (message.sender.toString() !== req.userId) {
        const hasRead = message.readBy.some(read => 
          read.user.toString() === req.userId
        );
        
        if (!hasRead) {
          message.readBy.push({
            user: req.userId,
            readAt: new Date()
          });
        }
      }
    });

    await chat.save();

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;