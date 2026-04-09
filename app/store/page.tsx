'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase' // Ensure this path is correct based on your folder structure
import { 
  ShoppingCart, User, Search, Package, MapPin, 
  ShieldCheck, RefreshCw, FileText, Building2, Trash2, ArrowLeft
} from 'lucide-react'
import toast from 'react-hot-toast'

// --- Interfaces ---
interface UserProfile { id: string; full_name: string; company_name?: string; email: string; role: string; client_type: string; wallet_balance: number; credit_limit: number; account_status: string; billing_address?: string; }
interface Product { id: string; name: string; description: string; category: string; unit: string; stock_quantity: number; price_d2c: number; price_b2b: number; image_url?: string; }
interface CartItem { product: Product; quantity: number; price: number; interval: string; }
interface OrderItem { id: string; name: string; price: number; unit: string; quantity: number; }
interface Order { id: string; total_amount: number; status: string; created_at: string; order_items: OrderItem[]; agent_id?: string; }

export default function CustomerStorefront() {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [customer, setCustomer] = useState<UserProfile | null>(null)
  
  // View State
  const [activeView, setActiveView] = useState<'shop' | 'account' | 'cart'>('shop')
  const [activeAccountTab, setActiveAccountTab] = useState<'details' | 'history'>('details')
  const [activeCategory, setActiveCategory] = useState('All')

  const [products, setProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderHistory, setOrderHistory] = useState<Order[]>([])
  const [rCash, setRCash] = useState(0) 

  // Subscription Modal State
  const [subModalProduct, setSubModalProduct] = useState<Product | null>(null)
  const [subInterval, setSubInterval] = useState<'One-time' | 'Weekly' | 'Monthly'>('One-time')

  const fetchStoreData = useCallback(async (userId: string) => {
    const { data: prodData } = await supabase.from('products').select('*').order('name', { ascending: true })
    if (prodData) setProducts(prodData as Product[])
    
    const { data: orderData } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (orderData) setOrderHistory(orderData as Order[])
  }, [])

  useEffect(() => {
    let isMounted = true
    const initStore = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return window.location.replace('/auth')
      const { data: roleData } = await supabase.from('user_roles').select('*').eq('id', session.user.id).single()
      
      if (roleData) {
        if (isMounted) {
          setCustomer(roleData as UserProfile)
          fetchStoreData(session.user.id)
        }
      }
      if (isMounted) setIsLoadingAuth(false)
    }
    initStore()
    return () => { isMounted = false }
  }, [fetchStoreData])

  const addToCart = (product: Product, interval: string = 'One-time') => {
    if (product.name.toLowerCase().includes('atta') && interval === 'One-time' && !subModalProduct) {
      setSubModalProduct(product);
      setSubInterval('One-time');
      return; 
    }

    const basePrice = customer?.client_type === 'D2C' ? product.price_d2c : product.price_b2b;
    const isAttaSub = interval !== 'One-time' && product.name.toLowerCase().includes('atta');
    const finalPrice = isAttaSub ? basePrice * 0.95 : basePrice;

    const existing = cart.find(c => c.product.id === product.id && c.interval === interval)
    
    if (existing) {
      setCart(cart.map(c => (c.product.id === product.id && c.interval === interval) ? { ...c, quantity: c.quantity + 1 } : c))
    } else {
      setCart([...cart, { product, quantity: 1, price: finalPrice, interval }])
    }
    
    toast.success(interval === 'One-time' ? 'Added to cart' : `Subscribed to ${interval} delivery!`)
    setSubModalProduct(null);
  }

  const removeFromCart = (productId: string, interval: string) => {
    setCart(cart.filter(c => !(c.product.id === productId && c.interval === interval)))
    toast.success('Removed from cart')
  }

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  const categories = ['All', 'Retail Flour', 'Modern', 'Flour', 'Dals', 'Other Pulses, Seeds & Grains', 'Rice & Millets', 'Whole Spices', 'Powdered Spices']
  const filteredProducts = products.filter(p => 
    (activeCategory === 'All' || p.category?.trim().toLowerCase() === activeCategory.trim().toLowerCase()) &&
    (p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.category?.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (isLoadingAuth) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500">Loading Storefront...</div>

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView('shop')}>
            <div className="w-8 h-8 bg-[#4F46E5] rounded flex items-center justify-center text-white font-bold text-lg">R</div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">Raj Gharona</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm outline-none focus:border-[#4F46E5] transition-colors" 
              />
            </div>
            
            <button onClick={() => setActiveView('account')} className={`flex items-center gap-2 text-sm font-bold transition-colors ${activeView === 'account' ? 'text-[#4F46E5]' : 'text-slate-700 hover:text-slate-900'}`}>
              <User size={18}/> Portal
            </button>
            
            <button onClick={() => setActiveView('cart')} className={`relative transition-colors ${activeView === 'cart' ? 'text-[#4F46E5]' : 'text-slate-700 hover:text-slate-900'}`}>
              <ShoppingCart size={22}/>
              {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-[#4F46E5] text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">{cart.length}</span>}
            </button>
          </div>
        </div>
      </header>

      {activeView === 'shop' && (
        <main>
          <div className="bg-[#0f172a] w-full">
            <div className="max-w-[1400px] mx-auto px-4 py-16 md:py-20 text-white relative overflow-hidden">
              <div className="relative z-10">
                <h1 className="text-4xl md:text-[44px] font-bold mb-3 tracking-tight">Premium Milling & Grains</h1>
                <p className="text-slate-400 text-lg">Freshly milled and delivered to your doorstep.</p>
              </div>
            </div>
          </div>

          <div className="max-w-[1400px] mx-auto px-4 py-8">
            <div className="flex gap-3 overflow-x-auto pb-6 hide-scrollbar">
              {categories.map(cat => (
                <button 
                  key={cat} 
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors border ${activeCategory === cat ? 'bg-[#4F46E5] text-white border-[#4F46E5]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-white rounded-[20px] shadow-sm border border-slate-100 overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
                  <div className="aspect-square bg-[#F8FAFC] relative flex items-center justify-center m-2 rounded-2xl overflow-hidden">
                    <span className="absolute top-3 left-3 bg-white text-[#4F46E5] text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow-sm z-10">
                      {product.category}
                    </span>
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover"/>
                    ) : (
                      <div className="text-slate-300 flex flex-col items-center">
                        <Package size={40} className="mb-2 opacity-50"/>
                        <span className="text-xs font-medium">No Image</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-bold text-slate-900 text-[15px] mb-1">{product.name}</h3>
                    <p className="text-xs text-slate-500 mb-4 line-clamp-2 min-h-[32px]">{product.description || product.category}</p>
                    
                    <div className="mt-auto border-t border-slate-100 pt-4 flex items-center justify-between">
                      <div>
                        <span className="text-lg font-black text-slate-900">₹{customer?.client_type === 'D2C' ? product.price_d2c : product.price_b2b}</span>
                        <span className="text-xs text-slate-500 font-medium ml-1">/{product.unit}</span>
                      </div>
                      <button onClick={() => addToCart(product)} className="w-9 h-9 bg-[#4F46E5] hover:bg-[#4338ca] text-white rounded-full flex items-center justify-center transition-colors shadow-sm">
                        <ShoppingCart size={16}/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {activeView === 'cart' && (
        <main className="max-w-[1000px] mx-auto px-4 py-10">
          <button onClick={() => setActiveView('shop')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm mb-6 transition-colors">
            <ArrowLeft size={16}/> Back to Shop
          </button>
          
          <h2 className="text-[28px] font-bold text-slate-900 mb-8">Your Cart</h2>

          {cart.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <ShoppingCart size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Your cart is empty</h3>
              <p className="text-slate-500 mb-6">Looks like you haven't added anything to your cart yet.</p>
              <button onClick={() => setActiveView('shop')} className="bg-[#4F46E5] hover:bg-[#4338ca] text-white px-6 py-3 rounded-xl font-bold transition-colors">
                Start Shopping
              </button>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex-1 space-y-4">
                {cart.map((item, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
                      {item.product.image_url ? (
                        <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover rounded-xl"/>
                      ) : (
                        <Package size={24} className="text-slate-300"/>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-slate-900">{item.product.name}</h3>
                          <p className="text-xs text-slate-500 mt-1">₹{item.price} / {item.product.unit}</p>
                        </div>
                        <span className="font-bold text-lg text-slate-900">₹{item.price * item.quantity}</span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${item.interval !== 'One-time' ? 'bg-indigo-50 text-[#4F46E5]' : 'bg-slate-100 text-slate-600'}`}>
                            {item.interval} Delivery
                          </span>
                          <span className="text-sm font-semibold text-slate-600">Qty: {item.quantity}</span>
                        </div>
                        <button onClick={() => removeFromCart(item.product.id, item.interval)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={18}/>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="w-full lg:w-[340px] shrink-0">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-24">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Order Summary</h3>
                  
                  <div className="space-y-3 text-sm mb-6">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Subtotal ({cart.length} items)</span>
                      <span className="font-bold text-slate-900">₹{cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Shipping</span>
                      <span className="font-bold text-emerald-600">Calculated at checkout</span>
                    </div>
                    <div className="border-t border-slate-100 pt-3 flex justify-between mt-2">
                      <span className="font-bold text-base text-slate-900">Total</span>
                      <span className="font-black text-xl text-[#4F46E5]">₹{cartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <button className="w-full bg-[#4F46E5] hover:bg-[#4338ca] text-white py-3.5 rounded-xl font-bold shadow-sm transition-colors flex justify-center items-center gap-2">
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {activeView === 'account' && (
        <main className="max-w-[1200px] mx-auto px-4 py-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-[28px] font-bold text-slate-900">My Account</h2>
              <p className="text-slate-500 text-sm mt-1">Manage your recent orders and personal details.</p>
            </div>
            <button className="bg-[#0f172a] text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
              <RefreshCw size={16}/> 1-Click Reorder
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-64 shrink-0 space-y-2">
              <button 
                onClick={() => setActiveAccountTab('details')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${activeAccountTab === 'details' ? 'bg-[#4F46E5] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Building2 size={18}/> Account Details
              </button>
              <button 
                onClick={() => setActiveAccountTab('history')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${activeAccountTab === 'history' ? 'bg-[#4F46E5] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Package size={18}/> Order History
              </button>
            </div>

            <div className="flex-1 space-y-6">
              {activeAccountTab === 'details' && (
                <>
                  <div className="bg-gradient-to-r from-[#ff7e22] to-[#ff5722] rounded-2xl p-6 text-white shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <Sparkles size={24} className="text-white"/>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-orange-100">R-Cash Rewards</p>
                        <p className="text-3xl font-black flex items-center gap-2">💎 {rCash} Points</p>
                      </div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl py-3 px-4 text-center font-bold text-sm relative z-10 border border-white/20">
                      1 R-Cash = ₹1 Off Next Order
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-xl border border-indigo-100">
                          {(customer?.full_name || customer?.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">{customer?.email}</h3>
                          <div className="flex gap-2 mt-2">
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">{customer?.client_type || 'D2C'}</span>
                            {customer?.account_status === 'active' && <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1"><ShieldCheck size={12}/> Verified</span>}
                          </div>
                        </div>
                      </div>
                      <button className="text-sm font-bold text-[#4F46E5] hover:underline">Edit Details</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Contact</h4>
                        <div className="space-y-3 text-sm">
                          <p className="flex justify-between"><span className="text-slate-500 font-medium">Name:</span> <span className="font-bold text-slate-900">{customer?.full_name || '-'}</span></p>
                          <p className="flex justify-between"><span className="text-slate-500 font-medium">Role:</span> <span className="font-bold text-slate-900 capitalize">{customer?.role || '-'}</span></p>
                          <p className="flex justify-between"><span className="text-slate-500 font-medium">Email:</span> <span className="font-bold text-slate-900">{customer?.email || '-'}</span></p>
                          <p className="flex justify-between"><span className="text-slate-500 font-medium">Phone:</span> <span className="font-bold text-slate-900">-</span></p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">Business</h4>
                        <div className="space-y-3 text-sm">
                          <p className="flex justify-between"><span className="text-slate-500 font-medium">Company:</span> <span className="font-bold text-slate-900">{customer?.company_name || '-'}</span></p>
                          <p className="flex justify-between"><span className="text-slate-500 font-medium">GST:</span> <span className="font-bold text-slate-900">-</span></p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Billing Address</h4>
                        <p className="text-sm font-medium text-slate-900">{customer?.billing_address || '-'}</p>
                      </div>
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Shipping Address</h4>
                        <p className="text-sm font-medium text-slate-900">-</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeAccountTab === 'history' && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-lg text-slate-900">Order History</h3>
                  </div>
                  <div className="divide-y divide-slate-100 p-2">
                    {orderHistory.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-sm">No previous orders found.</div>
                    ) : orderHistory.map(order => (
                      <div key={order.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-900">₹{order.total_amount.toLocaleString()}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">{order.status}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            #{order.id.split('-')[0].toUpperCase()} • {new Date(order.created_at).toLocaleDateString()}
                            <br/>
                            <span className="text-[#4F46E5] font-semibold mt-1 inline-block">Ordered via: {order.agent_id ? 'Company / Agent' : 'App'}</span>
                          </p>
                        </div>
                        <button className="text-sm font-bold text-[#4F46E5] flex items-center gap-1 hover:underline">
                          <FileText size={16}/> Details
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {subModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSubModalProduct(null)}></div>
          <div className="relative bg-white rounded-[20px] shadow-xl w-full max-w-md p-6 sm:p-8 animate-in zoom-in-95">
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Subscribe & Save</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">You are adding <strong className="text-slate-900">{subModalProduct.name}</strong>. Fresh Atta is best consumed weekly. Set up an automatic delivery and never run out.</p>
            
            <div className="space-y-3 mb-8">
              <label className={`block p-4 border rounded-xl cursor-pointer transition-colors ${subInterval === 'One-time' ? 'border-[#4F46E5] bg-indigo-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" checked={subInterval === 'One-time'} onChange={() => setSubInterval('One-time')} className="w-5 h-5 text-[#4F46E5]"/>
                  <span className="font-bold text-slate-900">One-time Purchase</span>
                </div>
              </label>
              
              <label className={`block p-4 border rounded-xl cursor-pointer transition-colors ${subInterval === 'Weekly' ? 'border-[#4F46E5] bg-indigo-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" checked={subInterval === 'Weekly'} onChange={() => setSubInterval('Weekly')} className="w-5 h-5 text-[#4F46E5]"/>
                  <div>
                    <span className="font-bold text-slate-900 block">Weekly Delivery</span>
                    <span className="text-xs text-emerald-600 font-bold">Recommended Only (5% Off)</span>
                  </div>
                </div>
              </label>
              
              <label className={`block p-4 border rounded-xl cursor-pointer transition-colors ${subInterval === 'Monthly' ? 'border-[#4F46E5] bg-indigo-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" checked={subInterval === 'Monthly'} onChange={() => setSubInterval('Monthly')} className="w-5 h-5 text-[#4F46E5]"/>
                  <div>
                    <span className="font-bold text-slate-900 block">Monthly Delivery</span>
                    <span className="text-xs text-slate-500 font-medium">Standard auto-replenish (5% Off)</span>
                  </div>
                </div>
              </label>
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setSubModalProduct(null)} className="flex-1 px-4 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={() => addToCart(subModalProduct, subInterval)} className="flex-1 px-4 py-3.5 rounded-xl font-bold text-white bg-[#4F46E5] hover:bg-[#4338ca] transition-colors shadow-sm">Add to Cart</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Dummy Icon
const Sparkles = ({ size, className }: { size: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
)