/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useCart } from './context/CartContext'
import Link from 'next/link'
import { 
  ShoppingCart, LogIn, UserCircle, X, Search, Loader2, 
  Trash2, Menu, Phone, Mail, MessageCircle, ChevronLeft, ChevronRight 
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Product {
  id: string; name: string; description: string; category: string; unit: string; stock_quantity: number;
  price_d2c: number; price_b2b: number; price_distributor: number; price_roti_factory: number; price_retail_modern: number; price_retail_old: number;
  image_url?: string; image_urls?: string[];
}

// 1. Defined a strict interface for the Razorpay success response
interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

const loadRazorpay = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function Storefront() {
  const { cartItems, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal } = useCart()
  
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [clientType, setClientType] = useState<string>('D2C')
  
  const [storeSettings, setStoreSettings] = useState({ reward_points_per_unit: 0.5, inr_per_reward_point: 1.0 })
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  
  const [modalQuantity, setModalQuantity] = useState(1) 
  const [isCartOpen, setIsCartOpen] = useState(false) 
  const [isCheckingOut, setIsCheckingOut] = useState(false) 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod' | 'wallet'>('online')

  useEffect(() => {
    const initializeStore = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: roleData } = await supabase.from('user_roles').select('role, client_type, account_status').eq('id', session.user.id).single()
        if (roleData) {
          setUserRole(roleData.role)
          if (roleData.account_status === 'active') setClientType(roleData.client_type || 'D2C')
        }
      }
      const { data: productData } = await supabase.from('products').select('*')
      if (productData) setProducts(productData as Product[])
      
      const { data: settingsData } = await supabase.from('store_settings').select('*').eq('id', 1).single()
      if (settingsData) setStoreSettings({ reward_points_per_unit: settingsData.reward_points_per_unit, inr_per_reward_point: settingsData.inr_per_reward_point })

      setIsLoading(false)
    }
    initializeStore()
  }, [])

  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(products.map(p => p.category)))]
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory
      const searchLower = searchQuery.toLowerCase()
      return matchesCategory && (product.name.toLowerCase().includes(searchLower) || product.description.toLowerCase().includes(searchLower))
    })
  }, [products, selectedCategory, searchQuery])

  const getDisplayPrice = (product: Product) => {
    switch (clientType) {
      case 'Wholesale': return product.price_b2b;
      case 'Distributor': return product.price_distributor;
      case 'Roti Factory': return product.price_roti_factory;
      case 'Retail (Modern)': return product.price_retail_modern;
      case 'Retail (Old School)': return product.price_retail_old;
      default: return product.price_d2c; 
    }
  }

  const handleAddToCart = () => {
    if (!selectedProduct) return
    addToCart({ id: selectedProduct.id, name: selectedProduct.name, price: getDisplayPrice(selectedProduct), unit: selectedProduct.unit, quantity: modalQuantity, image: selectedProduct.image_urls?.[0] || selectedProduct.image_url })
    toast.success(`${modalQuantity}x ${selectedProduct.name} added!`)
    setSelectedProduct(null); setModalQuantity(1); setIsCartOpen(true) 
  }

  const handleCheckout = async () => {
    if (cartItems.length === 0) return
    setIsCheckingOut(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setIsCartOpen(false); window.location.replace('/auth'); return }

    const { data: roleData } = await supabase.from('user_roles').select('*').eq('id', session.user.id).single()
    const finalCustomerName = roleData?.company_name || roleData?.full_name || session.user.email

    const finalizeOrderInDb = async (method: string, pStatus: string, oStatus: string) => {
      const { error } = await supabase.from('orders').insert([{
        user_id: session.user.id, customer_name: finalCustomerName, total_amount: cartTotal, 
        status: oStatus, payment_status: pStatus, payment_method: method, order_items: cartItems 
      }])
      if (!error) {
        const totalUnits = cartItems.reduce((sum, item) => sum + item.quantity, 0)
        const earnedRCash = totalUnits * storeSettings.reward_points_per_unit
        await supabase.from('user_roles').update({ r_cash_balance: (roleData?.r_cash_balance || 0) + earnedRCash }).eq('id', session.user.id)
        toast.success(`Success! You earned 💎 ${earnedRCash} R-Cash!`)
        clearCart(); setIsCartOpen(false); setTimeout(() => window.location.replace('/account'), 1500)
      } else { toast.error(error.message); setIsCheckingOut(false) }
    }

    if (clientType !== 'D2C') {
      const orderItemsText = cartItems.map(item => `- ${item.quantity}${item.unit} x ${item.name}`).join('\n')
      const waMessage = `Hello Raj Gharona Admin! 🌾\n\nI've submitted a B2B Request:\n*Business:* ${finalCustomerName}\n*Items:*\n${orderItemsText}\n*Value:* ₹${cartTotal.toLocaleString()}`;
      window.open(`https://wa.me/917683975998?text=${encodeURIComponent(waMessage)}`, '_blank')
      await finalizeOrderInDb('Pending Agreement', 'Unpaid', 'Pending Approval')
      return
    }

    if (paymentMethod === 'wallet') {
      if ((roleData?.wallet_balance || 0) < cartTotal) { toast.error("Insufficient Wallet Balance"); setIsCheckingOut(false); return }
      await supabase.from('user_roles').update({ wallet_balance: roleData!.wallet_balance - cartTotal }).eq('id', session.user.id)
      await finalizeOrderInDb('App Wallet', 'Paid', 'New Order'); return
    }

    if (paymentMethod === 'cod') { await finalizeOrderInDb('Cash on Delivery', 'Unpaid', 'New Order'); return }

    if (paymentMethod === 'online') {
      const res = await loadRazorpay()
      if (!res) { toast.error("Razorpay Error"); setIsCheckingOut(false); return }
      const options = {
        key: 'rzp_test_YOUR_KEY_HERE', 
        amount: cartTotal * 100, 
        currency: 'INR', 
        name: 'Raj Gharona', 
        // 2. Added type to the handler response
        handler: async (response: RazorpaySuccessResponse) => { 
          await finalizeOrderInDb(`Razorpay (${response.razorpay_payment_id})`, 'Paid', 'New Order') 
        },
        prefill: { name: finalCustomerName, email: session.user.email }, 
        theme: { color: '#4f46e5' } 
      }
      // 3. Fixed 'window' type error by casting to any
      const rzp = new (window as any).Razorpay(options); 
      rzp.open()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans overflow-x-hidden flex flex-col relative">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-600 rounded-full"><Menu size={24} /></button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-inner">R</div>
              <span className="text-xl font-bold text-slate-900 tracking-tight hidden sm:block">Raj Gharona</span>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden md:flex relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 rounded-full text-sm w-64 transition-all outline-none" />
            </div>
            {userRole ? (
              <Link href={userRole === 'admin' ? '/admin' : '/account'} className="hidden md:flex items-center gap-2 text-sm font-semibold text-slate-600">
                <UserCircle size={20} /> Portal
              </Link>
            ) : (
              <Link href="/auth" className="hidden md:flex items-center gap-2 text-sm font-semibold text-slate-600">
                <LogIn size={20} /> Sign In
              </Link>
            )}
            <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-slate-600">
              <ShoppingCart size={24} />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">{cartCount}</span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-start md:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="relative w-4/5 max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between p-6 border-b"><div className="flex items-center gap-2 font-bold text-slate-900">Raj Gharona</div><button onClick={() => setIsMobileMenuOpen(false)}><X size={20} /></button></div>
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="relative"><Search className="absolute left-4 top-3.5 text-slate-400" /><input type="text" placeholder="Search catalog..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-12 pr-4 py-3.5 w-full bg-slate-100 rounded-xl outline-none" /></div>
              <div className="space-y-4 pt-4 border-t">{userRole ? <Link href="/account" className="flex items-center gap-3 font-bold text-slate-700"><UserCircle size={24} /> My Account</Link> : <Link href="/auth" className="flex items-center gap-3 font-bold text-slate-700"><LogIn size={24} /> Sign In</Link>}</div>
            </div>
          </div>
        </div>
      )}

      <header className="bg-slate-900 text-white py-12 px-6 shrink-0">
        <div className="max-w-7xl mx-auto"><h1 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Premium Milling & Grains</h1><p className="text-slate-400 max-w-2xl">{clientType === 'D2C' ? "Freshly milled and delivered to your doorstep." : `B2B Portal: ${clientType} volume pricing active.`}</p></div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 flex-1 w-full">
        {!isLoading && products.length > 0 && <div className="flex gap-3 overflow-x-auto pb-6 hide-scrollbar">{categories.map(category => <button key={category} onClick={() => setSelectedCategory(category)} className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all ${selectedCategory === category ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{category}</button>)}</div>}
        
        {isLoading ? <div className="py-24 flex justify-center"><Loader2 size={48} className="animate-spin text-indigo-600" /></div> : filteredProducts.length === 0 ? <div className="text-center py-24 text-slate-400">No products found.</div> : 
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-500">
            {filteredProducts.map((p) => (
              <div key={p.id} onClick={() => { setSelectedProduct(p); setActiveImageIndex(0); setModalQuantity(1); }} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full">
                <div className="w-full aspect-square bg-slate-50 rounded-xl mb-4 overflow-hidden flex items-center justify-center">
                  {(p.image_urls?.[0] || p.image_url) ? <img src={p.image_urls?.[0] || p.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <span className="text-slate-300">No Image</span>}
                </div>
                <div className="flex-1"><span className="text-[10px] font-bold text-indigo-600 uppercase block mb-1">{p.category}</span><h3 className="font-bold text-slate-900 mb-2">{p.name}</h3><p className="text-slate-500 text-xs line-clamp-2">{p.description}</p></div>
                <div className="mt-4 pt-4 border-t flex items-center justify-between"><div><span className="text-lg font-bold text-slate-900">₹{getDisplayPrice(p)}</span><span className="text-[10px] text-slate-500 ml-1">/{p.unit}</span></div><button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors"><ShoppingCart size={18}/></button></div>
              </div>
            ))}
          </div>
        }
      </main>

      <footer className="bg-slate-900 text-slate-400 py-12 px-6 border-t border-slate-800"><div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12"><div><div className="flex items-center gap-2 mb-4 font-bold text-white">Raj Gharona</div><p className="text-sm">Premium milling directly to your facility.</p><div className="mt-4 inline-block px-3 py-1 bg-slate-800 rounded text-xs font-mono">FSSAI: 100210XXXXXX00</div></div><div><h4 className="text-white font-bold uppercase text-xs mb-4">Support</h4><div className="space-y-3 text-sm"><a href="tel:+917683975998" className="flex items-center gap-3"><Phone size={16}/> +91 76839 75998</a><a href="mailto:support@rajgharona.com" className="flex items-center gap-3"><Mail size={16}/> support@rajgharona.com</a></div></div><div><h4 className="text-white font-bold uppercase text-xs mb-4">Legal</h4><div className="flex flex-col space-y-3 text-sm"><Link href="#">Terms</Link><Link href="#">Privacy</Link><Link href="#">Refunds</Link></div></div></div></footer>

      <a href="https://wa.me/917683975998" target="_blank" rel="noreferrer" className="fixed bottom-6 right-6 bg-[#25D366] text-white p-4 rounded-full shadow-2xl z-50"><MessageCircle size={32} fill="white" /></a>

      {selectedProduct && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center shadow-sm"><X size={20} /></button>
            <div className="w-full md:w-1/2 bg-slate-100 relative group overflow-hidden flex flex-col">
              <div className="flex-1 flex items-center justify-center overflow-hidden">
                {(selectedProduct.image_urls?.[activeImageIndex] || selectedProduct.image_url) ? (
                   <img src={selectedProduct.image_urls?.[activeImageIndex] || selectedProduct.image_url} alt="" className="w-full h-full object-cover" />
                ) : <span className="text-slate-400">No Photo</span>}
              </div>
              {selectedProduct.image_urls && selectedProduct.image_urls.length > 1 && (
                <div className="p-4 bg-white/50 backdrop-blur flex gap-2 overflow-x-auto justify-center">
                  {selectedProduct.image_urls.map((url, idx) => (
                    <button key={idx} onClick={() => setActiveImageIndex(idx)} className={`w-12 h-12 rounded-lg border-2 transition-all ${activeImageIndex === idx ? 'border-indigo-600 scale-110' : 'border-transparent opacity-70'}`}>
                      <img src={url} className="w-full h-full object-cover rounded-md" alt=""/>
                    </button>
                  ))}
                </div>
              )}
              {selectedProduct.image_urls && selectedProduct.image_urls.length > 1 && (
                <>
                  <button onClick={() => setActiveImageIndex((prev) => (prev === 0 ? selectedProduct.image_urls!.length - 1 : prev - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft size={20}/></button>
                  <button onClick={() => setActiveImageIndex((prev) => (prev === selectedProduct.image_urls!.length - 1 ? 0 : prev + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight size={20}/></button>
                </>
              )}
            </div>
            <div className="w-full md:w-1/2 p-8 overflow-y-auto">
              <span className="text-xs font-bold text-indigo-600 uppercase mb-2 block">{selectedProduct.category}</span>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">{selectedProduct.name}</h2>
              <p className="text-slate-600 mb-6">{selectedProduct.description}</p>
              <div className="bg-slate-50 p-6 rounded-2xl border mb-8">
                <div className="flex items-baseline gap-2 mb-1"><span className="text-4xl font-bold">₹{getDisplayPrice(selectedProduct)}</span><span className="text-slate-500 font-medium">per {selectedProduct.unit}</span></div>
                {clientType !== 'D2C' && <p className="text-xs text-emerald-600 font-bold">✓ B2B Volume discount applied</p>}
              </div>
              <div className="flex gap-4">
                <div className="w-36 flex border-2 border-slate-200 rounded-xl overflow-hidden h-14">
                  <button onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))} className="w-12 h-full flex items-center justify-center font-bold text-slate-600 transition-colors">-</button>
                  <div className="flex-1 flex items-center justify-center font-bold text-slate-900 border-x border-slate-200">{modalQuantity}</div>
                  <button onClick={() => setModalQuantity(modalQuantity + 1)} className="w-12 h-full flex items-center justify-center font-bold text-slate-600 transition-colors">+</button>
                </div>
                <button onClick={handleAddToCart} className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all">Add to Cart</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-0 z-70 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b"><h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><ShoppingCart size={24} className="text-indigo-600" /> Your Cart</h2><button onClick={() => setIsCartOpen(false)}><X size={20} /></button></div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cartItems.length === 0 ? <div className="text-center py-24 text-slate-400">Cart is empty.</div> : cartItems.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0">{item.image && <img src={item.image} className="w-full h-full object-cover" alt=""/>}</div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div><h4 className="font-bold text-slate-900 text-sm">{item.name}</h4><p className="text-[10px] text-slate-500">₹{item.price} / {item.unit}</p></div>
                    <div className="flex items-center justify-between mt-2"><div className="flex items-center border border-slate-200 rounded-lg overflow-hidden h-8"><button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-full bg-slate-50 font-bold">-</button><span className="w-8 text-center text-xs font-bold">{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-full bg-slate-50 font-bold">+</button></div><button onClick={() => removeFromCart(item.id)} className="p-1 text-rose-500"><Trash2 size={16}/></button></div>
                  </div>
                </div>
              ))}
            </div>
            {cartItems.length > 0 && (
              <div className="p-6 bg-slate-50 border-t space-y-4">
                <div className="flex justify-between font-bold text-slate-900"><span>Subtotal</span><span>₹{cartTotal.toLocaleString()}</span></div>
                {clientType === 'D2C' && <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="w-full p-3 border rounded-xl outline-none"><option value="online">Online Pay</option><option value="cod">Cash on Delivery</option><option value="wallet">App Wallet</option></select>}
                <button onClick={handleCheckout} disabled={isCheckingOut} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all flex justify-between px-6">{isCheckingOut ? <Loader2 size={20} className="animate-spin" /> : <span>{clientType === 'D2C' ? 'Checkout' : 'Submit Request'}</span>}<span>₹{cartTotal.toLocaleString()}</span></button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}