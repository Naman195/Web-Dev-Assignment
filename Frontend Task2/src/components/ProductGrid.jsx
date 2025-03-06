import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { debounce } from 'lodash';
import './ProductGrid.css';

const ProductGrid = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));

  const productsPerPage = 6;

  // Configure axios defaults
  const api = axios.create({
    baseURL: 'http://localhost:8080/api',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add token to requests when available
  api.interceptors.request.use(
    (config) => {
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Function to fetch products with search capability
  const fetchProducts = useCallback(async (search = '', pageNum = 1, reset = false) => {
    if (loading || (!hasMore && pageNum > 1 && !reset)) return;
    
    setLoading(true);
    setError(null);

    try {
      let endpoint = '/products';
      if (search) {
        endpoint = `/products/search?name=${encodeURIComponent(search)}`;
      }

      const response = await api.get(endpoint);
      const fetchedProducts = response.data;

      // Simulate pagination from the full results set
      const startIndex = (pageNum - 1) * productsPerPage;
      const endIndex = startIndex + productsPerPage;
      const paginatedProducts = fetchedProducts.slice(startIndex, endIndex);

      if (reset || pageNum === 1) {
        setProducts(paginatedProducts);
      } else {
        setProducts(prevProducts => [...prevProducts, ...paginatedProducts]);
      }

      setHasMore(endIndex < fetchedProducts.length);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching products');
      if (err.response?.status === 401) {
        // Handle token expiration
        localStorage.removeItem('token');
        setIsLoggedIn(false);
        setToken('');
      }
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, token]);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((term) => {
      setPage(1);
      fetchProducts(term, 1, true);
    }, 500),
    [fetchProducts]
  );

  // Handle search input change
  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    debouncedSearch(term);
  };

  // Load more products when scrolling to bottom
  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchProducts(searchTerm, nextPage);
    }
  };

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    try {
      const response = await api.post('/auth/login', { username, password });
      const { token: newToken } = response.data;
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setIsLoggedIn(true);
      
      // Reload products after login
      fetchProducts(searchTerm, 1, true);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setIsLoggedIn(false);
    setProducts([]);
  };

  // Load initial products
  useEffect(() => {
    if (isLoggedIn) {
      fetchProducts('', 1, true);
    }
  }, [isLoggedIn, fetchProducts]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.5 }
    );

    const sentinel = document.querySelector('#scroll-sentinel');
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel);
      }
    };
  }, [loading, hasMore, handleLoadMore]);

  // Login form
  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <h2>Login to view products</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              name="username"
              required
              defaultValue="demouser"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              required
              defaultValue="password"
            />
          </div>
          <button type="submit" className="login-button">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="product-grid-container">
      <div className="header">
        <h1>Product Catalog</h1>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="product-grid">
        {products.map((product) => (
          <div key={product.id} className="product-card">
            <div className="product-image-container">
              <img 
                src={product.imageUrl || 'https://via.placeholder.com/150'} 
                alt={product.name}
                className="product-image"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://via.placeholder.com/150';
                }}
              />
            </div>
            <div className="product-details">
              <h3 className="product-name">{product.name}</h3>
              <p className="product-description">{product.description}</p>
              <p className="product-price">${product.price.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="loading">Loading products...</div>}
      
      {!loading && products.length === 0 && (
        <div className="no-products">No products found</div>
      )}

      {hasMore && <div id="scroll-sentinel" className="scroll-sentinel"></div>}
    </div>
  );
};

export default ProductGrid;