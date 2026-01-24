import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('azb_cart');
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    } catch (err) {
      console.error('Error loading cart from localStorage:', err);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('azb_cart', JSON.stringify(cartItems));
    } catch (err) {
      console.error('Error saving cart to localStorage:', err);
    }
  }, [cartItems]);

  const addToCart = (product) => {
    setCartItems((prevItems) => {
      // Check if product already exists in cart
      const existingItem = prevItems.find(
        (item) => item.id === product.id && item.category === product.category
      );

      if (existingItem) {
        // If exists, update quantity
        const newQuantity = existingItem.quantity + 1;
        return prevItems.map((item) =>
          item.id === product.id && item.category === product.category
            ? { ...item, quantity: newQuantity }
            : item
        );
      } else {
        // Add new item (quantity 1)
        return [
          ...prevItems,
            {
              id: product.id,
              sku: product.sku,
              name: product.name,
              category: product.category,
              price: product.selling_price || product.price || product.mrp || 0,
              mrp: product.mrp || product.price || 0,
              quantity: 1,
              ah_va: product.ah_va,
              warranty: product.warranty,
              series: product.series,
            },
        ];
      }
    });
  };

  const removeFromCart = (productId, category) => {
    setCartItems((prevItems) =>
      prevItems.filter(
        (item) => !(item.id === productId && item.category === category)
      )
    );
  };

  const updateQuantity = (productId, category, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId, category);
      return;
    }

    setCartItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === productId && item.category === category) {
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => {
      return total + item.price * item.quantity;
    }, 0);
  };

  const getCartItemCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  const getTotalSavings = () => {
    return cartItems.reduce((savings, item) => {
      const itemSavings = (item.mrp - item.price) * item.quantity;
      return savings + itemSavings;
    }, 0);
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartItemCount,
    getTotalSavings,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

