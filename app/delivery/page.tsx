'use client'

import { useEffect, useState, FormEvent, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  Truck, CheckCircle2, AlertCircle, MapPin, Phone, 
  Package, Navigation, IndianRupee, Loader2, LogOut, 
  ChevronRight, X, Camera, UploadCloud, ShieldCheck
} from 'lucide-react'
import toast from 'react-hot-toast'

// --- Interfaces ---
interface UserProfile { id: string; full_name: string; role: string; employee_number?: string; vehicle_number?: string; }
interface OrderItem { id: string; name: string; price: number; unit: string; quantity: number; }
interface Order { 
  id: string; user_id: string; customer_name: string; total_amount: number; 
  status: string; payment_status: string; payment_method: string; 
  created_at: string; order_items: OrderItem[]; 
  billing_address?: string; phone_number?: string;
}

export default function DeliveryHub() {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [driver, setDriver] = useState<UserProfile | null>(null)
  
  const [activeView, setActiveView] = useState<'manifest' | 'history'>('manifest')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --- Data States ---
  const [activeDeliveries, setActiveDeliveries] = useState<Order[]>([])
  const [completedDeliveries, setCompletedDeliveries] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // --- Payment States (For COD) ---
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'Cash', reference: '' })
  const [paymentProof, setPaymentProof] = useState<File | null>(null)

  const fetchDeliveries = useCallback(async () => {
    // Fetch orders that are Dispatched (Ready for delivery)
    const { data: dispatched } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'Dispatched')
      .order('created_at', { ascending: true })
    
    // Fetch orders Delivered today by this driver (Simulated for history)
    const today = new Date()
    today.setHours(0,0,0,0)
    const { data: completed } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'Delivered')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })

    if (dispatched) {
      // Enrich with customer address/phone if possible
      const enrichedDispatched = await Promise.all(dispatched.map(async (order) => {
        const { data: cust } = await supabase.from('user_roles').select('billing_address, phone_number').eq('id', order.user_id).single()
        return { ...order, billing_address: cust?.billing_address, phone_number: cust?.phone_number }
      }))
      setActiveDeliveries(enrichedDispatched as Order[])
    }
    if (completed) setCompletedDeliveries(completed as Order[])
  }, [])

  useEffect(() => {
    let isMounted = true
    const initDelivery = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return window.location.replace('/auth')
      
      const { data: roleData } = await supabase.from('user_roles').select('*').eq('id', session.user.id).single()
      
      if (roleData?.role === 'delivery' || roleData?.role === 'admin') {
        if (isMounted) {
          setIsAuthorized(true)
          setDriver(roleData as UserProfile)
          fetchDeliveries()
        }
      } else { window.location.replace('/') }
      
      if (isMounted) setIsLoadingAuth(false)
    }
    initDelivery()
    return () => { isMounted = false }
  }, [fetchDeliveries])

  const handleMarkDelivered = async () => {
    if (!selectedOrder) return
    setIsSubmitting(true)

    // Update order status to Delivered
    const { error } = await supabase.from('orders').update({ status: 'Delivered' }).eq('id', selectedOrder.id)
    
    if (!error) {
      toast.success('Order Marked as Delivered!')
      setSelectedOrder(null)
      fetchDeliveries()
    } else {
      toast.error(error.message)
    }
    setIsSubmitting(false)
  }

  const handleLogCODPayment = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedOrder) return
    setIsSubmitting(true)

    let proofUrl = ''
    if (paymentProof) {
      toast('Uploading receipt...', { icon: '📸' })
      const fileExt = paymentProof.name.split('.').pop()
      const fileName = `cod_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(fileName, paymentProof)
      if (!uploadError) proofUrl = supabase.storage.from('payment-proofs').getPublicUrl(fileName).data.publicUrl
    }

    // Log the collected cash into wallet requests for accounts to verify
    const { error } = await supabase.from('wallet_requests').insert([{
      user_id: selectedOrder.user_id, 
      customer_name: selectedOrder.customer_name,
      amount: Number(paymentForm.amount), 
      utr_number: `COD - ${paymentForm.method} - ${paymentForm.reference}`, 
      status: 'Pending', 
      proof_url: proofUrl || null
    }])

    if (!error) {
      toast.success('COD Payment Logged securely!')
      setShowPaymentModal(false)
      setPaymentForm({ amount: '', method: 'Cash', reference: '' })
      setPaymentProof(null)
      // Automatically mark as delivered after successful COD logging
      handleMarkDelivered()
    } else {
      toast.error(error.message)
      setIsSubmitting(false)
    }
  }

  const openGoogleMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank')
  }

  if (isLoadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 size={48} className="animate-spin text-indigo-600" /></div>
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center text-center p-12 font-bold text-slate-900"><AlertCircle size={64} className="mx-auto text-red-500 mb-4" />Delivery Role Required.</div>

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-30 shadow-md flex justify-between items-center">
        <div>
          <h1 className="font-bold text-lg flex items-center gap-2"><Truck size={20}/> RG Logistics</h1>
          <p className="text-xs text-slate-400 mt-0.5">{driver?.full_name} {driver?.vehicle_number ? `(${driver.vehicle_number})` : ''}</p>
        </div>
        <button onClick={() => { supabase.auth.signOut(); window.location.replace('/auth'); }} className="p-2 bg-slate-800 rounded-full text-slate-300 hover:text-white transition-colors">
          <LogOut size={18} />
        </button>
      </header>

      {/* Main Area */}
      <main className="p-4 max-w-lg mx-auto">
        
        {/* Toggle Tabs */}
        <div className="flex bg-slate-200 p-1 rounded-xl mb-6">
          <button onClick={() => setActiveView('manifest')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeView === 'manifest' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-600'}`}>Current Manifest</button>
          <button onClick={() => setActiveView('history')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeView === 'history' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-600'}`}>Completed Today</button>
        </div>

        {/* View: Manifest (Pending Deliveries) */}
        {activeView === 'manifest' && (
          <div className="space-y-4 animate-in fade-in">
            <h2 className="font-bold text-slate-500 text-xs uppercase tracking-wider pl-1 mb-2">Ready for Delivery ({activeDeliveries.length})</h2>
            
            {activeDeliveries.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-sm">
                <ShieldCheck size={48} className="mx-auto text-emerald-200 mb-4"/>
                <p className="font-bold text-slate-700">All caught up!</p>
                <p className="text-sm text-slate-500 mt-1">Wait for Dispatch to assign more orders.</p>
              </div>
            ) : (
              activeDeliveries.map((order, idx) => (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">{idx + 1}</div>
                      <div>
                        <h3 className="font-bold text-slate-900 leading-tight">{order.customer_name}</h3>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">#{order.id.split('-')[0].toUpperCase()}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-3 flex-1">
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                      <MapPin size={16} className="shrink-0 mt-0.5 text-slate-400"/>
                      <span className="line-clamp-2">{order.billing_address || 'Address not provided'}</span>
                    </div>
                    {order.phone_number && (
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <Phone size={16} className="text-slate-400"/> {order.phone_number}
                      </div>
                    )}
                    <div className="pt-3 mt-1 border-t border-slate-100 flex justify-between items-center">
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-500"><Package size={14}/> {order.order_items.length} items</div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">{order.payment_status}</p>
                        <p className="font-bold text-lg text-slate-900">₹{order.total_amount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 flex gap-2 border-t border-slate-100">
                    <button onClick={() => openGoogleMaps(order.billing_address || '')} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"><Navigation size={16}/> Navigate</button>
                    <button onClick={() => setSelectedOrder(order)} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform">Deliver <ChevronRight size={16}/></button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* View: Completed History */}
        {activeView === 'history' && (
          <div className="space-y-4 animate-in fade-in">
            <h2 className="font-bold text-slate-500 text-xs uppercase tracking-wider pl-1 mb-2">Completed Today ({completedDeliveries.length})</h2>
            {completedDeliveries.length === 0 ? <p className="text-center text-sm text-slate-500 py-8">No deliveries completed yet today.</p> : completedDeliveries.map((order) => (
              <div key={order.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{order.customer_name}</h3>
                  <p className="text-xs text-slate-500 mt-1">₹{order.total_amount.toLocaleString()} • {order.payment_status}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><CheckCircle2 size={16}/></div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* --- DELIVERY ACTION MODAL --- */}
      {selectedOrder && !showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}></div>
          <div className="relative bg-white rounded-3xl sm:rounded-none shadow-2xl w-full max-w-lg p-6 sm:p-8 animate-in slide-in-from-bottom-full duration-300">
            <button onClick={() => setSelectedOrder(null)} className="absolute top-4 right-4 p-2 bg-slate-100 text-slate-500 rounded-full"><X size={20}/></button>
            
            <h3 className="text-2xl font-bold text-slate-900 mb-1">{selectedOrder.customer_name}</h3>
            <p className="text-sm font-mono text-slate-500 mb-6">Order #{selectedOrder.id.split('-')[0].toUpperCase()}</p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Manifest Items</h4>
              <ul className="space-y-2">
                {selectedOrder.order_items.map((item, i) => (
                  <li key={i} className="flex justify-between text-sm font-medium text-slate-700">
                    <span>{item.quantity}x {item.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-between items-end mb-8">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status</p>
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${selectedOrder.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{selectedOrder.payment_status}</span>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Bill</p>
                <p className="text-3xl font-black text-slate-900">₹{selectedOrder.total_amount.toLocaleString()}</p>
              </div>
            </div>

            {selectedOrder.payment_status === 'Unpaid' ? (
              <div className="space-y-3">
                <button onClick={() => { setPaymentForm({...paymentForm, amount: selectedOrder.total_amount.toString()}); setShowPaymentModal(true) }} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 active:scale-95 transition-transform"><IndianRupee size={20}/> Collect COD & Mark Delivered</button>
                <button onClick={handleMarkDelivered} disabled={isSubmitting} className="w-full bg-white border-2 border-indigo-600 text-indigo-700 font-bold py-4 rounded-xl flex justify-center items-center gap-2 active:scale-95 transition-transform">{isSubmitting ? <Loader2 size={20} className="animate-spin"/> : <CheckCircle2 size={20}/>} Skip Payment & Mark Delivered</button>
                <p className="text-center text-[10px] text-slate-500 font-bold px-4">Only skip payment if the customer has agreed to pay via Credit/Ledger later.</p>
              </div>
            ) : (
              <button onClick={handleMarkDelivered} disabled={isSubmitting} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 active:scale-95 transition-transform">
                {isSubmitting ? <Loader2 size={20} className="animate-spin"/> : <CheckCircle2 size={20}/>} Confirm Drop-off
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- COD PAYMENT MODAL --- */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}></div>
          <div className="relative bg-white rounded-3xl sm:rounded-none shadow-2xl w-full max-w-lg p-6 sm:p-8 animate-in slide-in-from-bottom-full duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><IndianRupee className="text-emerald-600"/> Collect COD</h3>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 text-slate-400 hover:text-slate-900 rounded-full bg-slate-50"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleLogCODPayment} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative"><label className="block text-xs font-bold mb-2 text-slate-700 uppercase">Amount</label><span className="absolute left-3 top-[26px] font-bold text-slate-400">₹</span><input required type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full p-2.5 pl-7 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase">Method</label><select required value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"><option value="Cash">Cash</option><option value="UPI">UPI Scanner</option></select></div>
              </div>

              {paymentForm.method === 'UPI' && (
                <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase">UPI Reference / UTR</label><input required type="text" value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})} className="w-full p-3 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 outline-none focus:border-emerald-500" placeholder="Required for UPI"/></div>
              )}

              <div>
                <label className="block text-xs font-bold mb-2 text-slate-700 uppercase">Attach Photo (Mandatory)</label>
                <label className="block w-full bg-emerald-50 p-4 rounded-xl border border-emerald-200 border-dashed hover:bg-emerald-100 transition-colors cursor-pointer text-center group">
                  <Camera className="mx-auto text-emerald-500 mb-2" size={24}/>
                  <span className="text-xs font-bold text-emerald-700">{paymentProof ? paymentProof.name : 'Tap to photograph Cash/UPI screen'}</span>
                  <input required type="file" accept="image/*" capture="environment" onChange={e => e.target.files && setPaymentProof(e.target.files[0])} className="hidden"/>
                </label>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 mt-4 active:scale-95 transition-transform">
                {isSubmitting ? <Loader2 size={20} className="animate-spin"/> : <CheckCircle2 size={20}/>} Confirm & Complete Delivery
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}