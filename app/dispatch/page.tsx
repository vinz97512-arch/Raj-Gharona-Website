'use client'

import { useEffect, useState, FormEvent, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  Package, Truck, ArrowRight, Loader2, LogOut, 
  Menu, X, ShieldCheck, UserCircle, Map, AlertCircle, ReceiptText
} from 'lucide-react'
import toast from 'react-hot-toast'

// --- Interfaces ---
interface UserProfile { id: string; full_name: string; email: string; role: string; employee_number?: string; emergency_contact?: string; id_proof_number?: string; }
interface OrderItem { id: string; name: string; price: number; unit: string; quantity: number; }
interface Order { id: string; customer_name: string; total_amount: number; status: string; created_at: string; order_items: OrderItem[]; }

export default function DispatchHub() {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [manager, setManager] = useState<UserProfile | null>(null)
  
  const [activeView, setActiveView] = useState<'orders' | 'fleet' | 'profile'>('orders')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --- Data States ---
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<UserProfile[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // --- Form States ---
  const [hrForm, setHrForm] = useState({ employee_number: '', emergency_contact: '', id_proof_number: '' })
  const [beatForm, setBeatForm] = useState({ driver_id: '', target_id: '' })

  const fetchDispatchData = useCallback(async () => {
    // 1. Fetch Orders Pipeline
    const { data: orderData } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (orderData) setOrders(orderData as Order[])

    // 2. Fetch Active Delivery Drivers
    const { data: driverData } = await supabase.from('user_roles').select('*').eq('role', 'delivery')
    if (driverData) setDrivers(driverData as UserProfile[])
  }, [])

  useEffect(() => {
    let isMounted = true
    const initDispatch = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return window.location.replace('/auth')
      
      const { data: roleData } = await supabase.from('user_roles').select('*').eq('id', session.user.id).single()
      
      // Strict MECE Role Check: Only Dispatch (or Admin overlay) can access
      if (roleData?.role === 'dispatch' || roleData?.role === 'admin') {
        if (isMounted) {
          setIsAuthorized(true)
          setManager(roleData as UserProfile)
          setHrForm({ employee_number: roleData.employee_number || '', emergency_contact: roleData.emergency_contact || '', id_proof_number: roleData.id_proof_number || '' })
          fetchDispatchData()
        }
      } else { window.location.replace('/') }
      
      if (isMounted) setIsLoadingAuth(false)
    }
    initDispatch()
    return () => { isMounted = false }
  }, [fetchDispatchData])

  // --- Actions ---
  const handleUpdateHR = async (e: FormEvent) => {
    e.preventDefault(); if (!manager) return; setIsSubmitting(true)
    const { error } = await supabase.from('user_roles').update(hrForm).eq('id', manager.id)
    if (!error) { toast.success('Profile Updated!'); setManager({ ...manager, ...hrForm }) } 
    else { toast.error(error.message) }
    setIsSubmitting(false)
  }

  const advancePipeline = async (id: string, currentStatus: string) => {
    const pipeline = ['New Order', 'Pending Approval', 'Awaiting Payment', 'Processing (Milling)', 'Dispatched', 'Delivered']
    const currentIndex = pipeline.indexOf(currentStatus)
    
    if (currentIndex < pipeline.length - 1) {
      const nextStatus = pipeline[currentIndex + 1]
      const { error } = await supabase.from('orders').update({ status: nextStatus }).eq('id', id)
      if (!error) { toast.success(`Order moved to: ${nextStatus}`); fetchDispatchData() }
      else { toast.error(error.message) }
    }
  }

  const handleAssignFleet = async (e: FormEvent) => {
    e.preventDefault(); setIsSubmitting(true)
    const order = orders.find(o => o.id === beatForm.target_id)
    if (!order) return
    
    // Assigning a specific order to a specific driver's delivery beat
    const { error } = await supabase.from('daily_beats').insert([{
      agent_id: beatForm.driver_id,
      target_id: order.id,
      target_name: order.customer_name,
      target_type: 'Delivery',
      status: 'Pending'
    }])

    if (!error) {
      toast.success('Manifest assigned to Driver!')
      setBeatForm({ driver_id: '', target_id: '' })
    } else { toast.error(error.message) }
    setIsSubmitting(false)
  }

  const navItems = [
    { id: 'orders', icon: Package, label: 'Dispatch Pipeline' },
    { id: 'fleet', icon: Truck, label: 'Fleet Assignment' },
    { id: 'profile', icon: UserCircle, label: 'My HR Profile' },
  ]

  if (isLoadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 size={48} className="animate-spin text-indigo-600" /></div>
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center text-center p-12 font-bold text-slate-900"><AlertCircle size={64} className="mx-auto text-red-500 mb-4" />Dispatch Access Required.</div>

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row w-full overflow-x-hidden text-slate-900 font-sans">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white h-16 flex items-center justify-between px-4 sticky top-0 z-30 shrink-0 shadow-md">
        <div className="font-bold text-lg flex items-center gap-2"><Package size={20}/> Dispatch Ops</div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-300"><Menu size={24} /></button>
      </div>

      {/* Sidebar Navigation */}
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
          <span className="text-white font-bold text-lg flex items-center gap-2"><ShieldCheck size={20} className="text-indigo-400"/> Dispatch</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white"><X size={20}/></button>
        </div>
        <div className="p-6 border-b border-slate-800 bg-slate-800/30">
          <p className="text-white font-bold truncate">{manager?.full_name || 'Manager'}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{manager?.employee_number || 'ID Pending'}</p>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveView(item.id as any); setIsMobileMenuOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${activeView === item.id ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
              <item.icon size={20} className={activeView === item.id ? 'text-indigo-200' : 'text-slate-400'} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800"><button onClick={() => { supabase.auth.signOut(); window.location.replace('/auth'); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl font-bold transition-colors"><LogOut size={20} /> Logout</button></div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-screen">
        <header className="mb-6 md:mb-8"><h2 className="text-2xl font-bold text-slate-900 tracking-tight">{navItems.find(n => n.id === activeView)?.label}</h2></header>

        {/* 1. ORDERS PIPELINE */}
        {activeView === 'orders' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in">
            {/* We show actionable states for Dispatch */}
            {['Awaiting Payment', 'Processing (Milling)', 'Dispatched'].map(stage => (
              <div key={stage} className="bg-slate-200/50 p-4 rounded-3xl border border-slate-200 min-h-[500px] flex flex-col">
                <h3 className="font-bold text-slate-700 mb-4 uppercase text-xs tracking-widest pl-2">{stage}</h3>
                <div className="space-y-4 flex-1">
                  {orders.filter(o => o.status === stage).map(order => (
                    <div key={order.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 group">
                      <div className="flex justify-between items-start mb-2 text-[10px] font-mono text-slate-400 uppercase">
                        #{order.id.split('-')[0]}
                        <button onClick={() => setSelectedOrder(order)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"><ReceiptText size={16}/></button>
                      </div>
                      <div className="font-bold text-slate-900 leading-tight mb-1 text-lg">{order.customer_name}</div>
                      <div className="text-slate-500 text-sm font-medium mb-4">{order.order_items.length} Items • ₹{order.total_amount.toLocaleString()}</div>
                      
                      <button onClick={() => advancePipeline(order.id, order.status)} className="w-full bg-slate-50 border border-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors shadow-sm">
                        {stage === 'Dispatched' ? 'Mark Delivered' : 'Advance Stage'} <ArrowRight size={14}/>
                      </button>
                    </div>
                  ))}
                  {orders.filter(o => o.status === stage).length === 0 && (
                    <div className="text-center text-slate-400 text-sm font-medium py-8 italic border-2 border-dashed border-slate-200 rounded-xl">No orders in this stage</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. FLEET ASSIGNMENT */}
        {activeView === 'fleet' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-4xl animate-in fade-in">
            <div className="flex items-start gap-4 border-b border-slate-100 pb-6 mb-6">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0"><Truck size={24}/></div>
              <div><h3 className="text-xl font-bold text-slate-900">Manifest Assignment</h3><p className="text-sm text-slate-500 mt-1">Assign processed orders directly to driver devices.</p></div>
            </div>
            
            <form onSubmit={handleAssignFleet} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-700 uppercase">Select Target Order</label>
                  <select required value={beatForm.target_id} onChange={e => setBeatForm({...beatForm, target_id: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="" disabled>-- Processed Orders --</option>
                    {orders.filter(o => o.status === 'Processing (Milling)' || o.status === 'Dispatched').map(o => <option key={o.id} value={o.id}>{o.customer_name} (Order #{o.id.split('-')[0].toUpperCase()})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-700 uppercase">Assign to Driver</label>
                  <select required value={beatForm.driver_id} onChange={e => setBeatForm({...beatForm, driver_id: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="" disabled>-- Active Drivers --</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name || d.email}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mt-4">{isSubmitting ? <Loader2 size={20} className="animate-spin"/> : 'Send Manifest to Driver App'}</button>
            </form>
          </div>
        )}

        {/* 3. MY HR PROFILE */}
        {activeView === 'profile' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-2xl animate-in fade-in">
            <h3 className="text-xl font-bold mb-6 text-slate-900 flex items-center gap-2"><UserCircle className="text-indigo-600"/> Dispatch Manager Profile</h3>
            <form onSubmit={handleUpdateHR} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase">Employee Number</label><input required type="text" value={hrForm.employee_number} onChange={e => setHrForm({...hrForm, employee_number: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-indigo-500 uppercase" placeholder="e.g. RG-DSP-01"/></div>
                <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase">ID Proof (Aadhaar/PAN)</label><input required type="text" value={hrForm.id_proof_number} onChange={e => setHrForm({...hrForm, id_proof_number: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-indigo-500 uppercase" placeholder="ID Number"/></div>
              </div>
              <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase">Emergency Contact</label><input required type="text" value={hrForm.emergency_contact} onChange={e => setHrForm({...hrForm, emergency_contact: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-indigo-500" placeholder="Name - Phone Number"/></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 size={20} className="animate-spin"/> : 'Save Profile Details'}</button>
            </form>
          </div>
        )}

      </main>

      {/* --- INVOICE MODAL --- */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900">Order Manifest</h3>
              <button onClick={() => setSelectedOrder(null)} className="p-2 bg-white text-slate-400 hover:text-slate-900 rounded-full shadow-sm"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6"><p className="text-xs font-bold text-slate-500 uppercase">Customer</p><p className="font-bold text-lg text-slate-900">{selectedOrder.customer_name}</p></div>
              <table className="w-full text-left whitespace-nowrap"><thead className="bg-slate-50 border-y border-slate-200"><tr><th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase">Item</th><th className="py-3 px-4 text-xs font-bold text-slate-600 uppercase text-right">Qty</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedOrder.order_items.map((item, idx) => (<tr key={idx}><td className="py-4 px-4 font-bold text-slate-900">{item.name}</td><td className="p-4 text-slate-700 font-medium text-right">{item.quantity} {item.unit}</td></tr>))}</tbody></table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}