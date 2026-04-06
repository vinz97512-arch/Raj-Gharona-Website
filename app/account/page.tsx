'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  User, Building2, Package, Receipt, LogOut, Loader2, 
  ShieldCheck, Wallet, RotateCcw, Truck, CheckCircle2, Clock, X, ReceiptText, Printer, Phone, Mail, MessageCircle, Save, ClipboardList, Calculator, Sparkles
} from 'lucide-react'
import { useCart } from '../context/CartContext'
import toast from 'react-hot-toast'

interface UserProfile {
  id: string; email: string; role: string; company_name: string | null; client_type: string; account_status: string; wallet_balance: number;
  full_name?: string; gst_number?: string; phone_number?: string; organization_role?: string; billing_address?: string; shipping_address?: string;
  r_cash_balance?: number; // NEW: R-Cash
}
interface OrderItem { id: string; name: string; price: number; unit: string; quantity: number; }
interface Order { 
  id: string; total_amount: number; status: string; created_at: string; order_items: OrderItem[]; payment_method?: string; 
  freight_charges?: number; toll_charges?: number; loading_charges?: number; packaging_charges?: number; gateway_charges?: number; other_charges?: number;
}

export default function ClientPortal() {
  const router = useRouter()
  const { addToCart } = useCart()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true) 
  
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'billing' | 'quotes'>('profile')

  const [showWalletModal, setShowWalletModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null) 
  
  const [walletAmount, setWalletAmount] = useState('')
  const [utrNumber, setUtrNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<Partial<UserProfile>>({})

  const pendingQuotesCount = orders.filter(o => o.status === 'Pending Approval' || o.status === 'Awaiting Payment').length

  useEffect(() => {
    let isMounted = true
    const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.replace('/auth'); return }

      const { data: roleData } = await supabase.from('user_roles').select('*').eq('id', session.user.id).single()
      if (roleData) {
        if (roleData.role === 'admin') { window.location.replace('/admin'); return }
        if (isMounted) { setProfile(roleData as UserProfile); setProfileForm(roleData) }
      }

      const { data: orderData } = await supabase.from('orders').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
      if (isMounted) {
        if (orderData) setOrders(orderData as Order[])
        setIsLoading(false)
      }
    }
    fetchUserData()
    return () => { isMounted = false }
  }, [])

  const handleWalletRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setIsSubmitting(true)
    const { error } = await supabase.from('wallet_requests').insert([{ user_id: profile.id, customer_name: profile.company_name || profile.email, amount: Number(walletAmount), utr_number: utrNumber, status: 'Pending' }])
    if (!error) { toast.success("Payment Reference Submitted!"); setShowWalletModal(false); setWalletAmount(''); setUtrNumber('') } 
    else { toast.error("Error: " + error.message) }
    setIsSubmitting(false)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setIsSubmitting(true)
    const payload = { full_name: profileForm.full_name || '', company_name: profileForm.company_name || null, gst_number: profileForm.gst_number || '', phone_number: profileForm.phone_number || '', organization_role: profileForm.organization_role || '', billing_address: profileForm.billing_address || '', shipping_address: profileForm.shipping_address || '' }
    const { error } = await supabase.from('user_roles').update(payload).eq('id', profile.id)
    if (!error) { toast.success("Profile updated successfully!"); setProfile({ ...profile, ...payload } as UserProfile); setIsEditingProfile(false) } 
    else { toast.error("Failed to update profile: " + error.message) }
    setIsSubmitting(false)
  }

  const handlePayQuote = async (order: Order) => {
    if (!profile) return
    if (profile.wallet_balance < order.total_amount) { toast.error(`Insufficient Ledger Balance. Need ₹${order.total_amount.toLocaleString()}.`, { duration: 5000 }); return }
    
    setIsSubmitting(true)
    const newBalance = profile.wallet_balance - order.total_amount
    await supabase.from('user_roles').update({ wallet_balance: newBalance }).eq('id', profile.id)
    
    const { error } = await supabase.from('orders').update({ status: 'Processing (Milling)', payment_status: 'Paid', payment_method: 'B2B Ledger Wallet' }).eq('id', order.id)

    if (!error) {
      toast.success('Quote Accepted & Paid Successfully!')
      setProfile({ ...profile, wallet_balance: newBalance })
      setOrders(orders.map(o => o.id === order.id ? { ...o, status: 'Processing (Milling)', payment_status: 'Paid', payment_method: 'B2B Ledger Wallet' } : o))
    } else { toast.error('Payment failed: ' + error.message) }
    setIsSubmitting(false)
  }

  const handleSmartReorder = () => {
    if (orders.length === 0 || !orders[0].order_items) return
    orders[0].order_items.forEach((item: OrderItem) => { addToCart({ id: item.id, name: item.name, price: item.price, unit: item.unit, quantity: item.quantity }) })
    toast.success("Past order added to cart!")
    router.push('/') 
  }

  const handleLogout = async () => { toast('Logging out...', { icon: '👋' }); await supabase.auth.signOut(); window.location.replace('/auth') }
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Delivered': return <CheckCircle2 size={20} className="text-emerald-500" />
      case 'Dispatched': return <Truck size={20} className="text-indigo-500" />
      case 'Processing (Milling)': return <Clock size={20} className="text-amber-500 animate-pulse" />
      default: return <Package size={20} className="text-slate-400" />
    }
  }

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 size={48} className="animate-spin text-indigo-600" /></div>
  if (!profile) return null
  const isB2B = profile.client_type !== 'D2C'

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative flex flex-col">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm print:hidden shrink-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity"><div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">R</div><span className="font-bold text-slate-900 hidden md:block">&larr; Back to Store</span></Link>
          <button onClick={handleLogout} className="text-sm font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-2 transition-colors"><LogOut size={16} /> Sign Out</button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 print:hidden flex-1 w-full">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div><h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{isB2B ? 'Partner Portal' : 'My Account'}</h1><p className="text-sm md:text-base text-slate-500">{isB2B ? `Manage your ${profile.client_type} orders, billing, and company details.` : 'Manage your recent orders and personal details.'}</p></div>
          {orders.length > 0 && orders[0].order_items && <button onClick={handleSmartReorder} className="w-full md:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 md:py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95"><RotateCcw size={18} /> 1-Click Reorder</button>}
        </div>

        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          <aside className="w-full md:w-64 shrink-0 flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <button onClick={() => setActiveTab('profile')} className={`whitespace-nowrap shrink-0 md:w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-left ${activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 bg-white md:bg-transparent hover:bg-slate-200/50'}`}><Building2 size={20} /> Account Details</button>
            {isB2B && <button onClick={() => setActiveTab('quotes')} className={`whitespace-nowrap shrink-0 md:w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-left ${activeTab === 'quotes' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-600 bg-white md:bg-transparent hover:bg-slate-200/50'}`}><div className="flex items-center gap-3"><ClipboardList size={20} /> Quotes & Approvals</div>{pendingQuotesCount > 0 && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeTab === 'quotes' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700 animate-pulse'}`}>{pendingQuotesCount}</span>}</button>}
            <button onClick={() => setActiveTab('orders')} className={`whitespace-nowrap shrink-0 md:w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-left ${activeTab === 'orders' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 bg-white md:bg-transparent hover:bg-slate-200/50'}`}><div className="flex items-center gap-3"><Package size={20} /> Order History</div></button>
            {isB2B && <button onClick={() => setActiveTab('billing')} className={`whitespace-nowrap shrink-0 md:w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-left ${activeTab === 'billing' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 bg-white md:bg-transparent hover:bg-slate-200/50'}`}><Receipt size={20} /> Invoices & Ledger</button>}
          </aside>

          <div className="flex-1">
            {activeTab === 'quotes' && isB2B && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-amber-50 p-6 border border-amber-200 rounded-2xl"><h3 className="font-bold text-amber-900 flex items-center gap-2 mb-1"><Calculator size={20}/> Review Negotiated Quotes</h3><p className="text-sm text-amber-700">Orders here have been reviewed by the admin. Review the added freight and transport charges, then accept the quote to begin milling.</p></div>
                {orders.filter(o => o.status === 'Pending Approval' || o.status === 'Awaiting Payment').length === 0 ? <div className="p-12 bg-white rounded-2xl text-center text-slate-500 font-medium border border-slate-200">No pending quotes or approvals.</div> : orders.filter(o => o.status === 'Pending Approval' || o.status === 'Awaiting Payment').map(order => (
                  <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
                    <div className="p-6 md:w-1/2 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/50">
                      <div className="flex justify-between items-center mb-4"><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order #{order.id.split('-')[0].toUpperCase()}</span><span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${order.status === 'Pending Approval' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>{order.status}</span></div>
                      <div className="space-y-2 mb-4 max-h-40 overflow-y-auto pr-2">{order.order_items.map((item, idx) => (<div key={idx} className="flex justify-between text-sm"><span className="font-medium text-slate-700">{item.quantity}x {item.name}</span><span className="text-slate-500">₹{(item.quantity * item.price).toLocaleString()}</span></div>))}</div>
                    </div>
                    <div className="p-6 md:w-1/2 flex flex-col justify-center">
                      {order.status === 'Pending Approval' ? (
                        <div className="text-center space-y-3"><Clock size={32} className="mx-auto text-slate-300" /><p className="text-slate-500 font-medium">Waiting for Admin to assign freight and logistics charges.</p></div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-y-2 text-sm">
                            <div className="text-slate-500">Base Materials:</div><div className="font-bold text-right text-slate-900">₹{(order.total_amount - (order.freight_charges || 0) - (order.toll_charges || 0) - (order.loading_charges || 0) - (order.packaging_charges || 0) - (order.gateway_charges || 0) - (order.other_charges || 0)).toLocaleString()}</div>
                            <div className="text-slate-500">Freight:</div><div className="font-medium text-right text-slate-700">+ ₹{(order.freight_charges || 0).toLocaleString()}</div>
                            <div className="text-slate-500">Tolls & Taxes:</div><div className="font-medium text-right text-slate-700">+ ₹{(order.toll_charges || 0).toLocaleString()}</div>
                            <div className="text-slate-500">Loading/Unloading:</div><div className="font-medium text-right text-slate-700">+ ₹{(order.loading_charges || 0).toLocaleString()}</div>
                            <div className="text-slate-500">Packaging (Bags):</div><div className="font-medium text-right text-slate-700">+ ₹{(order.packaging_charges || 0).toLocaleString()}</div>
                            <div className="text-slate-500">Other / Gateway:</div><div className="font-medium text-right text-slate-700">+ ₹{((order.gateway_charges || 0) + (order.other_charges || 0)).toLocaleString()}</div>
                          </div>
                          <div className="pt-3 border-t border-slate-200 flex justify-between items-center"><span className="font-bold text-slate-900">Grand Total</span><span className="text-2xl font-bold text-emerald-600">₹{order.total_amount.toLocaleString()}</span></div>
                          <button onClick={() => handlePayQuote(order)} disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 flex justify-center items-center gap-2 mt-4">{isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />} Accept & Pay via Ledger</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                
                {/* --- NEW: WALLET AND R-CASH CARDS --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {/* Ledger Card */}
                  {isB2B && (
                    <div className="bg-linear-to-br from-indigo-900 to-slate-900 p-6 md:p-8 rounded-2xl shadow-lg text-white flex flex-col justify-between gap-6 relative overflow-hidden">
                      <div className="flex items-center gap-4 w-full relative z-10">
                        <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0"><Wallet size={28} className="text-indigo-300" /></div>
                        <div><p className="text-indigo-200 font-medium mb-1 text-sm md:text-base">Ledger Balance</p><h3 className="text-2xl md:text-3xl font-bold">₹{(profile.wallet_balance || 0).toLocaleString()}</h3></div>
                      </div>
                      <button onClick={() => setShowWalletModal(true)} className="w-full px-6 py-3.5 bg-white text-slate-900 font-bold rounded-xl hover:bg-indigo-50 transition-all active:scale-95 shadow-md whitespace-nowrap relative z-10">Request Credit Line +</button>
                    </div>
                  )}

                  {/* R-Cash Card */}
                  <div className={`bg-linear-to-br from-amber-500 to-orange-600 p-6 md:p-8 rounded-2xl shadow-lg text-white flex flex-col justify-between gap-6 relative overflow-hidden ${!isB2B ? 'md:col-span-2' : ''}`}>
                    <div className="flex items-center gap-4 w-full relative z-10">
                      <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shrink-0"><Sparkles size={28} className="text-amber-100" /></div>
                      <div><p className="text-amber-100 font-medium mb-1 text-sm md:text-base">R-Cash Rewards</p><h3 className="text-2xl md:text-3xl font-bold">💎 {(profile.r_cash_balance || 0).toLocaleString()} Points</h3></div>
                    </div>
                    <div className="w-full px-6 py-3.5 bg-white/20 border border-white/30 text-white font-bold rounded-xl text-center shadow-sm whitespace-nowrap relative z-10">1 R-Cash = ₹1 Off Next Order</div>
                  </div>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4"><div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 shrink-0">{isB2B ? <Building2 size={32} /> : <User size={32} />}</div><div><h2 className="text-xl font-bold text-slate-900">{profile.company_name || profile.full_name || profile.email}</h2><div className="flex flex-wrap items-center gap-2 mt-2"><span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-md uppercase tracking-wider">{profile.client_type}</span>{profile.account_status === 'active' && <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md"><ShieldCheck size={14} /> Verified</span>}</div></div></div>
                    {!isEditingProfile && <button onClick={() => setIsEditingProfile(true)} className="text-indigo-600 text-sm font-bold hover:underline">Edit Details</button>}
                  </div>
                  {isEditingProfile ? (
                    <form onSubmit={handleSaveProfile} className="space-y-6 pt-4 border-t border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label><input required type="text" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={profileForm.full_name || ''} onChange={e => setProfileForm({...profileForm, full_name: e.target.value})} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</label><input type="text" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Purchase Manager" value={profileForm.organization_role || ''} onChange={e => setProfileForm({...profileForm, organization_role: e.target.value})} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Name</label><input required={isB2B} type="text" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={profileForm.company_name || ''} onChange={e => setProfileForm({...profileForm, company_name: e.target.value})} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">GST Number</label><input type="text" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 uppercase" placeholder="Optional" value={profileForm.gst_number || ''} onChange={e => setProfileForm({...profileForm, gst_number: e.target.value})} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</label><input required type="tel" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={profileForm.phone_number || ''} onChange={e => setProfileForm({...profileForm, phone_number: e.target.value})} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label><input disabled type="email" className="w-full p-3 border rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed" value={profile.email} /></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Billing Address</label><textarea required rows={3} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none" value={profileForm.billing_address || ''} onChange={e => setProfileForm({...profileForm, billing_address: e.target.value})} /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shipping Address</label><textarea required rows={3} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none" value={profileForm.shipping_address || ''} onChange={e => setProfileForm({...profileForm, shipping_address: e.target.value})} /></div>
                      </div>
                      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100"><button type="button" onClick={() => setIsEditingProfile(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button><button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95">{isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Details</button></div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                      <div><h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Contact</h4><div className="space-y-2 text-sm text-slate-700"><p><span className="font-semibold text-slate-900">Name:</span> {profile.full_name || '-'}</p><p><span className="font-semibold text-slate-900">Role:</span> {profile.organization_role || '-'}</p><p><span className="font-semibold text-slate-900">Email:</span> {profile.email}</p><p><span className="font-semibold text-slate-900">Phone:</span> {profile.phone_number || '-'}</p></div></div>
                      <div><h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Business</h4><div className="space-y-2 text-sm text-slate-700"><p><span className="font-semibold text-slate-900">Company:</span> {profile.company_name || '-'}</p><p><span className="font-semibold text-slate-900">GST:</span> {profile.gst_number ? <span className="font-mono uppercase bg-slate-100 px-1.5 py-0.5 rounded">{profile.gst_number}</span> : '-'}</p></div></div>
                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t border-slate-50"><div><h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Billing Address</h4><p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{profile.billing_address || '-'}</p></div><div><h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Shipping Address</h4><p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{profile.shipping_address || '-'}</p></div></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-4">
                  {orders.filter(o => o.status !== 'Pending Approval' && o.status !== 'Awaiting Payment').length === 0 ? (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center py-24"><Package size={48} className="mx-auto text-slate-300 mb-4" /><h3 className="text-xl font-bold text-slate-800">No Active Orders</h3><Link href="/" className="inline-block mt-6 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors">Start Shopping</Link></div>
                  ) : orders.filter(o => o.status !== 'Pending Approval' && o.status !== 'Awaiting Payment').map((order) => (
                    <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                      <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                        <div><p className="text-sm font-semibold text-slate-500 mb-1">Order #{order.id.split('-')[0].toUpperCase()}</p><p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString()}</p></div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-2"><p className="text-lg font-bold text-slate-900">₹{order.total_amount.toLocaleString()}</p><button onClick={() => setSelectedOrder(order)} className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 sm:bg-transparent px-3 py-1 sm:px-0 sm:py-0 rounded-lg"><ReceiptText size={16}/> View Invoice</button></div>
                      </div>
                      <div className="p-4 md:p-6 flex items-center gap-3"><div className={`p-3 rounded-full ${order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>{getStatusIcon(order.status)}</div><div><h4 className="font-bold text-slate-900 flex items-center gap-2">Status: {order.status}</h4></div></div>
                    </div>
                  ))}
              </div>
            )}
            
            {activeTab === 'billing' && isB2B && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="p-6 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-900">B2B Order Ledger</h3><p className="text-sm text-slate-500 mt-1">Download official tax invoices for your accounting department.</p></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-50/50 border-b border-slate-100"><tr><th className="p-4 text-xs font-bold text-slate-500 uppercase">Date</th><th className="p-4 text-xs font-bold text-slate-500 uppercase">Order ID</th><th className="p-4 text-xs font-bold text-slate-500 uppercase">Amount</th><th className="p-4 text-xs font-bold text-slate-500 uppercase">Payment</th><th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Invoice</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">No ledger history available.</td></tr> : orders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 text-sm text-slate-600">{new Date(order.created_at).toLocaleDateString()}</td><td className="p-4 font-mono text-xs font-bold text-slate-500">#{order.id.split('-')[0].toUpperCase()}</td><td className="p-4 font-bold text-slate-900">₹{order.total_amount.toLocaleString()}</td><td className="p-4 text-sm text-slate-600">{order.payment_method || 'Ledger'}</td><td className="p-4 text-right"><button onClick={() => setSelectedOrder(order)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">View / Print</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-12 px-6 mt-auto border-t border-slate-800 shrink-0 print:hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4"><div className="flex items-center gap-2"><div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-inner">R</div><span className="text-xl font-bold text-white tracking-tight">Raj Gharona</span></div><p className="text-sm leading-relaxed max-w-xs">Premium milling and fresh grains delivered directly to your home or B2B facility.</p><div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg text-sm font-mono text-slate-300"><span className="font-bold text-white">FSSAI:</span> 100210XXXXXX00</div></div>
          <div className="space-y-4"><h4 className="text-white font-bold uppercase tracking-wider text-sm">Customer Support</h4><div className="space-y-3">
            {/* UPDATED WA NUMBER */}
            <a href="tel:+917683975998" className="flex items-center gap-3 text-sm hover:text-white transition-colors"><Phone size={16} className="text-indigo-400" /> +91 76839 75998 (Mon-Sat)</a>
            <a href="mailto:support@rajgharona.com" className="flex items-center gap-3 text-sm hover:text-white transition-colors"><Mail size={16} className="text-indigo-400" /> support@rajgharona.com</a>
          </div></div>
          <div className="space-y-4"><h4 className="text-white font-bold uppercase tracking-wider text-sm">Legal & Policies</h4><div className="flex flex-col space-y-3 text-sm"><Link href="#" className="hover:text-white transition-colors hover:underline">Terms & Conditions</Link><Link href="#" className="hover:text-white transition-colors hover:underline">Privacy Policy</Link><Link href="#" className="hover:text-white transition-colors hover:underline">Refund & Cancellation</Link><Link href="#" className="hover:text-white transition-colors hover:underline">Shipping Policy</Link></div></div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-800 text-sm text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4"><p>&copy; {new Date().getFullYear()} Raj Gharona. All rights reserved.</p><p className="text-slate-500">Secure Payments processed locally in India.</p></div>
      </footer>

      {/* UPDATED WA BUBBLE */}
      <a href="https://wa.me/917683975998" target="_blank" rel="noreferrer" className="fixed bottom-6 right-6 md:bottom-10 md:right-10 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform z-50 flex items-center justify-center cursor-pointer hover:shadow-[#25D366]/30 print:hidden" title="Chat with us on WhatsApp"><MessageCircle size={32} fill="white" /></a>

      {/* Modals omitted, unchanged */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowWalletModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 md:p-8 animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200">
            <button onClick={() => setShowWalletModal(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Request Credit Reload</h3>
            <p className="text-slate-500 text-sm mb-6">Transfer funds to the primary RGDB account and enter your UTR / Transaction ID below for approval.</p>
            <form onSubmit={handleWalletRequest} className="space-y-4">
              <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Amount Paid (₹)</label><input required type="number" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 50000" /></div>
              <div><label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Bank UTR / Reference No.</label><input required type="text" value={utrNumber} onChange={(e) => setUtrNumber(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. UBIN0123456789" /></div>
              <button disabled={isSubmitting} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-md mt-4 flex items-center justify-center active:scale-95">{isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Submit for Admin Approval'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}