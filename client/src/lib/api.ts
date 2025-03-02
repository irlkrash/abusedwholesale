
// API client for making requests to the server

/**
 * Base API function to fetch data with proper error handling
 */
export const fetchApi = async <T>(
  url: string, 
  options: RequestInit = {}
): Promise<T> => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `API request failed with status ${response.status}`
      );
    }

    // For no-content responses
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};

/**
 * Product related API calls
 */
export const productApi = {
  getProducts: (params: string) => 
    fetchApi<any>(`/api/products${params ? `?${params}` : ''}`),
  
  getProduct: (id: string) => 
    fetchApi<any>(`/api/products/${id}`),
  
  createProduct: (data: any) => 
    fetchApi<any>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateProduct: (id: string, data: any) => 
    fetchApi<any>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  deleteProduct: (id: string) => 
    fetchApi<any>(`/api/products/${id}`, {
      method: 'DELETE',
    }),
};

/**
 * Category related API calls
 */
export const categoryApi = {
  getCategories: () => 
    fetchApi<any>('/api/categories'),
  
  getCategory: (id: string) => 
    fetchApi<any>(`/api/categories/${id}`),
  
  createCategory: (data: any) => 
    fetchApi<any>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateCategory: (id: string, data: any) => 
    fetchApi<any>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  deleteCategory: (id: string) => 
    fetchApi<any>(`/api/categories/${id}`, {
      method: 'DELETE',
    }),
};

/**
 * Cart related API calls
 */
export const cartApi = {
  getCart: () => 
    fetchApi<any>('/api/carts'),
  
  addToCart: (productId: string, quantity: number) => 
    fetchApi<any>('/api/carts/items', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    }),
  
  updateCartItem: (itemId: string, quantity: number) => 
    fetchApi<any>(`/api/carts/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    }),
  
  removeFromCart: (itemId: string) => 
    fetchApi<any>(`/api/carts/items/${itemId}`, {
      method: 'DELETE',
    }),
  
  clearCart: () => 
    fetchApi<any>('/api/carts', {
      method: 'DELETE',
    }),
};

/**
 * Auth related API calls
 */
export const authApi = {
  login: (credentials: { username: string; password: string }) => 
    fetchApi<any>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  
  logout: () => 
    fetchApi<any>('/api/auth/logout', {
      method: 'POST',
    }),
  
  getCurrentUser: () => 
    fetchApi<any>('/api/auth/me'),
  
  register: (userData: any) => 
    fetchApi<any>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
};

export default {
  product: productApi,
  category: categoryApi,
  cart: cartApi,
  auth: authApi,
};
