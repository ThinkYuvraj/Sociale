import React, { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import CreatePost from '../components/Posts/CreatePost';
import PostCard from '../components/Posts/PostCard';
import StoriesBar from '../components/Stories/StoriesBar';
import SuggestedUsers from '../components/Users/SuggestedUsers';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import InfiniteScroll from 'react-infinite-scroll-component';

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async (pageNum = 1) => {
    try {
      const response = await axios.get(`/api/posts/feed?page=${pageNum}&limit=10`);
      const newPosts = response.data.posts;
      
      if (pageNum === 1) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      
      setHasMore(response.data.hasMore);
      setPage(pageNum);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setLoading(false);
    }
  };

  const fetchMorePosts = () => {
    fetchPosts(page + 1);
  };

  const handleNewPost = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
  };

  const handlePostUpdate = (updatedPost) => {
    setPosts(prev => prev.map(post => 
      post._id === updatedPost._id ? updatedPost : post
    ));
  };

  const handlePostDelete = (postId) => {
    setPosts(prev => prev.filter(post => post._id !== postId));
  };

  if (loading) {
    return <LoadingSpinner text="Loading your feed..." />;
  }

  return (
    <Container fluid className="py-4">
      <Row>
        {/* Left Sidebar - Hidden on mobile */}
        <Col lg={3} className="d-none d-lg-block">
          <div className="sticky-top" style={{ top: '100px' }}>
            <SuggestedUsers />
          </div>
        </Col>

        {/* Main Content */}
        <Col lg={6} md={8} className="mx-auto">
          {/* Stories Bar */}
          <StoriesBar />

          {/* Create Post */}
          <CreatePost onPostCreated={handleNewPost} />

          {/* Posts Feed */}
          <InfiniteScroll
            dataLength={posts.length}
            next={fetchMorePosts}
            hasMore={hasMore}
            loader={<LoadingSpinner size="sm" text="Loading more posts..." />}
            endMessage={
              <div className="text-center py-4">
                <p className="text-muted">You've seen all posts!</p>
              </div>
            }
          >
            {posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                onUpdate={handlePostUpdate}
                onDelete={handlePostDelete}
              />
            ))}
          </InfiniteScroll>

          {posts.length === 0 && (
            <div className="text-center py-5">
              <i className="fas fa-newspaper fa-3x text-muted mb-3"></i>
              <h4 className="text-muted">No posts yet</h4>
              <p className="text-muted">Follow some users to see their posts in your feed!</p>
            </div>
          )}
        </Col>

        {/* Right Sidebar - Hidden on mobile */}
        <Col lg={3} className="d-none d-lg-block">
          <div className="sticky-top" style={{ top: '100px' }}>
            {/* Additional widgets can go here */}
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Home;