'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface CartItem {
  id: string;
  name: string;
  price: number;
  unit: string;
  quantity: number;
  image?: string;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // 1. LOAD CART FROM LOCAL STORAGE ON MOUNT
  useEffect(() => {
    const savedCart = localStorage.getItem('rgdb_saved_cart')
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart))
      } catch (e) {
        console.error('Failed to parse cart', e)
      }
    }
    setIsInitialized(true)
  }, [])

  // 2. SAVE CART TO LOCAL STORAGE WHENEVER IT CHANGES
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('rgdb_saved_cart', JSON.stringify(cartItems))
    }
  }, [cartItems, isInitialized])

  // 3. SMART ADD TO CART (Appends new, or updates quantity of existing)
  const addToCart = (newItem: CartItem) => {
    setCartItems(prevItems => {
      // Check if the exact product is already in the cart
      const existingItemIndex = prevItems.findIndex(item => item.id === newItem.id)
      
      if (existingItemIndex >= 0) {
        // If it exists, just increase the quantity
        const updatedItems = [...prevItems]
        updatedItems[existingItemIndex].quantity += newItem.quantity
        return updatedItems
      } else {
        // If it's a new product, add it to the end of the list
        return [...prevItems, newItem]
      }
    })
  }

  // 4. REMOVE ITEM
  const removeFromCart = (id: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== id))
  }

  // 5. UPDATE SPECIFIC QUANTITY
  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) {
      removeFromCart(id)
      return
    }
    setCartItems(prevItems => 
      prevItems.map(item => item.id === id ? { ...item, quantity } : item)
    )
  }

  // 6. CLEAR CART (Used after successful checkout)
  const clearCart = () => {
    setCartItems([])
    localStorage.removeItem('rgdb_saved_cart')
  }

  // CALCULATIONS
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  return (
    <CartContext.Provider value={{ 
      cartItems, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal 
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}