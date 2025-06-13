const express = require('express');
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Create a new post
router.post('/', auth, upload.array('media', 10), async (req, res) => {
  try {
    const { content, tags, location, privacy } = req.body;
    
    const post = new Post({
      author: req.userId,
      content,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      location: location || '',
      privacy: privacy || 'public'
    });

    // Handle uploaded media
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        if (file.resource_type === 'image') {
          post.images.push({
            url: file.secure_url,
            publicId: file.public_id
          });
        } else if (file.resource_type === 'video') {
          post.videos.push({
            url: file.secure_url,
            publicId: file.public_id
          });
        }
      });
    }

    await post.save();

    // Add post to user's posts array
    await User.findByIdAndUpdate(req.userId, {
      $push: { posts: post._id }
    });

    // Populate author information
    await post.populate('author', 'username firstName lastName profilePicture');

    res.status(201).json({
      message: 'Post created successfully',
      post
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get feed posts
router.get('/feed', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const currentUser = await User.findById(req.userId);
    
    // Get posts from followed users and own posts
    const followingIds = [...currentUser.following, req.userId];
    
    const posts = await Post.find({
      author: { $in: followingIds },
      privacy: { $in: ['public', 'friends'] }
    })
    .populate('author', 'username firstName lastName profilePicture isVerified')
    .populate('comments.user', 'username firstName lastName profilePicture')
    .populate('likes.user', 'username firstName lastName profilePicture')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    res.json({
      posts,
      currentPage: page,
      hasMore: posts.length === limit
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single post
router.get('/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate('author', 'username firstName lastName profilePicture isVerified')
      .populate('comments.user', 'username firstName lastName profilePicture')
      .populate('likes.user', 'username firstName lastName profilePicture');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json({ post });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Like/Unlike post
router.post('/:postId/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const likeIndex = post.likes.findIndex(like => 
      like.user.toString() === req.userId
    );

    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // Like
      post.likes.push({ user: req.userId });
    }

    await post.save();

    res.json({
      message: likeIndex > -1 ? 'Post unliked' : 'Post liked',
      likesCount: post.likes.length,
      isLiked: likeIndex === -1
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add comment to post
router.post('/:postId/comment', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = {
      user: req.userId,
      content,
      createdAt: new Date()
    };

    post.comments.push(comment);
    await post.save();

    // Populate the new comment
    await post.populate('comments.user', 'username firstName lastName profilePicture');

    const newComment = post.comments[post.comments.length - 1];

    res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete post
router.delete('/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user owns the post
    if (post.author.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await Post.findByIdAndDelete(req.params.postId);

    // Remove post from user's posts array
    await User.findByIdAndUpdate(req.userId, {
      $pull: { posts: req.params.postId }
    });

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save/Unsave post
router.post('/:postId/save', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const postId = req.params.postId;

    const isSaved = user.savedPosts.includes(postId);

    if (isSaved) {
      user.savedPosts.pull(postId);
    } else {
      user.savedPosts.push(postId);
    }

    await user.save();

    res.json({
      message: isSaved ? 'Post unsaved' : 'Post saved',
      isSaved: !isSaved
    });
  } catch (error) {
    console.error('Save post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;