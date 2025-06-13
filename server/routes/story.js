const express = require('express');
const Story = require('../models/Story');
const User = require('../models/User');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Create a new story
router.post('/', auth, upload.single('media'), async (req, res) => {
  try {
    const { content, backgroundColor, textColor } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'Media file is required for story' });
    }

    const story = new Story({
      author: req.userId,
      content: content || '',
      media: {
        type: req.file.resource_type,
        url: req.file.secure_url,
        publicId: req.file.public_id
      },
      backgroundColor: backgroundColor || '#000000',
      textColor: textColor || '#ffffff'
    });

    await story.save();
    await story.populate('author', 'username firstName lastName profilePicture');

    res.status(201).json({
      message: 'Story created successfully',
      story
    });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get stories from followed users
router.get('/feed', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    const followingIds = [...currentUser.following, req.userId];

    // Get active stories (not expired)
    const stories = await Story.find({
      author: { $in: followingIds },
      expiresAt: { $gt: new Date() }
    })
    .populate('author', 'username firstName lastName profilePicture')
    .populate('viewers.user', 'username firstName lastName profilePicture')
    .sort({ createdAt: -1 });

    // Group stories by author
    const groupedStories = {};
    stories.forEach(story => {
      const authorId = story.author._id.toString();
      if (!groupedStories[authorId]) {
        groupedStories[authorId] = {
          author: story.author,
          stories: []
        };
      }
      groupedStories[authorId].stories.push(story);
    });

    res.json({
      stories: Object.values(groupedStories)
    });
  } catch (error) {
    console.error('Get stories feed error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// View a story
router.post('/:storyId/view', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);
    
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Check if story is expired
    if (story.expiresAt < new Date()) {
      return res.status(410).json({ message: 'Story has expired' });
    }

    // Check if user already viewed this story
    const hasViewed = story.viewers.some(viewer => 
      viewer.user.toString() === req.userId
    );

    if (!hasViewed) {
      story.viewers.push({
        user: req.userId,
        viewedAt: new Date()
      });
      await story.save();
    }

    res.json({
      message: 'Story viewed',
      viewersCount: story.viewers.length
    });
  } catch (error) {
    console.error('View story error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get story viewers
router.get('/:storyId/viewers', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId)
      .populate('viewers.user', 'username firstName lastName profilePicture');
    
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Check if user owns the story
    if (story.author.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to view story viewers' });
    }

    res.json({
      viewers: story.viewers.sort((a, b) => b.viewedAt - a.viewedAt)
    });
  } catch (error) {
    console.error('Get story viewers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete story
router.delete('/:storyId', auth, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);
    
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Check if user owns the story
    if (story.author.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this story' });
    }

    await Story.findByIdAndDelete(req.params.storyId);

    res.json({ message: 'Story deleted successfully' });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;