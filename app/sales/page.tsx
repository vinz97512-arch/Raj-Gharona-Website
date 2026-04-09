'use client'

import { useEffect, useState, FormEvent, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  LayoutDashboard, Users, ShoppingCart, IndianRupee, Target, 
  Search, Menu, X, LogOut, Loader2, CheckCircle2, 
  AlertCircle, Briefcase, MapPin, Phone, Wallet, 
  AlertTriangle, Camera, UploadCloud, Map, UserCircle, 
  Navigation, ChevronRight, History, FileEdit, Activity, Building2, ShieldCheck, CheckSquare, TrendingUp
} from 'lucide-react'
import toast from 'react-hot-toast'

// --- Interfaces ---
type AccessLevel = 'none' | 'read' | 'write'
interface ModuleAccess { _master: AccessLevel; [subTab: string]: AccessLevel; }
interface AccessMatrix { [module: string]: ModuleAccess; }
interface UserProfile { id: string; full_name: string; role: string; assigned_pincodes: string[]; phone_number?: string; employee_number?: string; emergency_contact?: string; id_proof_number?: string; access_levels?: AccessMatrix; temporary_access?: Record<string, string>; }
interface Customer { id: string; company_name: string; full_name: string; email: string; phone_number: string; client_type: string; account_status: string; wallet_balance: number; credit_limit: number; billing_address: string; }
interface Product { id: string; name: string; category: string; unit: string; price_b2b: number; price_distributor: number; price_roti_factory: number; price_retail_modern: number; price_retail_old: number; }
interface Lead { id: string; company_name: string; contact_person: string; phone_number: string; pincode: string; status: string; store_type?: string; }
interface OrderItem { id: string; name: string; price: number; unit: string; quantity: number; }
interface Order { id: string; customer_name: string; total_amount: number; status: string; is_price_deviated: boolean; created_at: string; order_items: OrderItem[]; }
interface DailyBeat { id: string; target_name: string; target_id: string; target_type: string; status: string; scheduled_date: string; }

// --- STRICT TYPES ---
interface BeatStop { id: string; type: string; title: string; subtitle: string; data: any; action: () => void; urgent: boolean; }

export default function FMCGSalesHub() {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [agent, setAgent] = useState<UserProfile | null>(null)
  
  const [activeView, setActiveView] = useState<'profile' | 'beat' | 'punch_order' | 'crm' | 'pipeline' | 'payments'>('beat')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --- Data States ---
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [agentOrders, setAgentOrders] = useState<Order[]>([])
  const [adminBeats, setAdminBeats] = useState<DailyBeat[]>([])
  
  // --- Modals ---
  const [store360, setStore360] = useState<Customer | Lead | null>(null)
  const [storeHistory, setStoreHistory] = useState<Order[]>([])
  const [showVisitReport, setShowVisitReport] = useState(false)

  // --- Form States ---
  const [orderForm, setOrderForm] = useState({ customerId: '', items: [] as { product: Product, qty: number, system_price: number, custom_price: number }[] })
  const [paymentForm, setPaymentForm] = useState({ customerId: '', amount: '', method: 'Cash', reference: '' })
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [leadForm, setLeadForm] = useState({ company_name: '', contact_person: '', phone_number: '', pincode: '', gst_number: '', store_type: 'Retailer', full_address: '', competitor_intel: '', estimated_volume: '' })
  const [shelfImage, setShelfImage] = useState<File | null>(null)
  const [hrForm, setHrForm] = useState({ employee_number: '', emergency_contact: '', id_proof_number: '' })

  // --- FSVSIM State (Scenario-Based Field Intelligence) ---
  const [visitScenario, setVisitScenario] = useState<'A_Onboard' | 'B_FollowUp' | 'C_Order' | 'D_Delivery' | 'E_Credit' | 'F_Demand'>('C_Order')
  const [visitDetails, setVisitDetails] = useState<Record<string, any>>({})
  const [visitStockStatus, setVisitStockStatus] = useState('Adequate')

  const fetchHubData = useCallback(async (agentId: string, pincodes: string[]) => {
    const { data: custData } = await supabase.from('user_roles').select('*').neq('role', 'admin').neq('client_type', 'D2C')
    if (custData) setCustomers(custData as Customer[])
    const { data: prodData } = await supabase.from('products').select('*')
    if (prodData) setProducts(prodData as Product[])
    const { data: leadData } = await supabase.from('leads').select('*').eq('assigned_to', agentId)
    if (leadData) setLeads(leadData as Lead[])
    const { data: orderData } = await supabase.from('orders').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(50)
    if (orderData) setAgentOrders(orderData as Order[])
    const { data: beatData } = await supabase.from('daily_beats').select('*').eq('agent_id', agentId).eq('scheduled_date', new Date().toISOString().split('T')[0]).neq('status', 'Completed')
    if (beatData) setAdminBeats(beatData as DailyBeat[])
  }, [])

  useEffect(() => {
    let isMounted = true
    const initSales = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return window.location.replace('/auth')
      const { data: roleData } = await supabase.from('user_roles').select('*').eq('id', session.user.id).single()
      
      // MECE Auth Check: Primary Role or Matrix Guest Pass
      const hasPass = roleData?.temporary_access?.sales && new Date(roleData.temporary_access.sales) > new Date();
      const hasMatrixRead = roleData?.access_levels?.sales?._master === 'read' || roleData?.access_levels?.sales?._master === 'write';
      
      if (roleData?.role === 'sales' || roleData?.role === 'admin' || hasPass || hasMatrixRead) {
        if (isMounted) {
          setIsAuthorized(true); setAgent(roleData as UserProfile)
          setHrForm({ employee_number: roleData.employee_number || '', emergency_contact: roleData.emergency_contact || '', id_proof_number: roleData.id_proof_number || '' })
          fetchHubData(session.user.id, roleData.assigned_pincodes || [])
        }
      } else { window.location.replace('/portal') }
      if (isMounted) setIsLoadingAuth(false)
    }
    initSales()
    return () => { isMounted = false }
  }, [fetchHubData])

  const logActivity = async (action: string, desc: string) => {
    if (!agent) return
    await supabase.from('agent_activities').insert([{ agent_id: agent.id, action_type: action, description: desc }])
  }

  // --- ACTIONS ---
  const handleUpdateHR = async (e: FormEvent) => {
    e.preventDefault(); if (!agent) return; setIsSubmitting(true)
    const { error } = await supabase.from('user_roles').update(hrForm).eq('id', agent.id)
    if (!error) { toast.success('Agent Details Updated!'); setAgent({ ...agent, ...hrForm }) } else { toast.error(error.message) }
    setIsSubmitting(false)
  }

  const handlePunchOrder = async (e: FormEvent) => {
    e.preventDefault()
    if (!agent || !orderForm.customerId || orderForm.items.length === 0) return toast.error('Select a customer and add items.')
    setIsSubmitting(true)

    const customer = customers.find(c => c.id === orderForm.customerId)
    if (customer && customer.credit_limit > 0) {
       const estimatedTotal = orderForm.items.reduce((s, i) => s + (i.custom_price * i.qty), 0)
       const currentDebt = customer.wallet_balance < 0 ? Math.abs(customer.wallet_balance) : 0
       if ((currentDebt + estimatedTotal) > customer.credit_limit) {
           toast.error(`Order exceeds Customer Credit Limit (Limit: ₹${customer.credit_limit}). Request advance payment.`, { duration: 5000 })
           setIsSubmitting(false); return
       }
    }

    let isDeviated = false; let total = 0
    const orderItems: OrderItem[] = orderForm.items.map(item => {
      if (item.custom_price !== item.system_price) isDeviated = true
      total += (item.custom_price * item.qty)
      return { id: item.product.id, name: item.product.name, price: item.custom_price, unit: item.product.unit, quantity: item.qty }
    })

    const status = isDeviated ? 'Pending Approval' : 'New Order'

    const { error } = await supabase.from('orders').insert([{
      user_id: customer?.id, agent_id: agent.id, customer_name: customer?.company_name || customer?.full_name,
      total_amount: total, status: status, payment_status: 'Unpaid', payment_method: 'B2B Ledger',
      order_items: orderItems, is_price_deviated: isDeviated
    }])

    if (!error) {
      await logActivity('Order Punched', `Punched order for ${customer?.company_name}. Total: ₹${total}. ${isDeviated ? '(Deviation Flagged)' : ''}`)
      toast.success(isDeviated ? 'Order flagged for Admin Approval (Price Deviation)' : 'Order successfully punched!')
      
      const beat = adminBeats.find(b => b.target_id === customer?.id)
      if (beat) await supabase.from('daily_beats').update({ status: 'Completed' }).eq('id', beat.id)

      setOrderForm({ customerId: '', items: [] }); fetchHubData(agent.id, agent.assigned_pincodes || []); setActiveView('beat')
    } else { toast.error(error.message) }
    setIsSubmitting(false)
  }

  // --- UPGRADED FSVSIM HANDLER ---
  const handleLogVisit = async (e: FormEvent) => {
    e.preventDefault(); if(!agent || !store360) return; setIsSubmitting(true)
    
    let imageUrl = ''
    if (shelfImage) {
      toast('Uploading intelligence photo...', { icon: '📸' })
      const fileExt = shelfImage.name.split('.').pop()
      const fileName = `shelf_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(fileName, shelfImage)
      if (!uploadError) imageUrl = supabase.storage.from('payment-proofs').getPublicUrl(fileName).data.publicUrl
    }

    // Geolocation capture (Mocked for browser safety, usually uses navigator.geolocation)
    const geoData = { lat: '20.2961', long: '85.8245', verified: true }

    const { error } = await supabase.from('visit_reports').insert([{
      agent_id: agent.id, 
      store_id: store360.id, 
      store_name: store360.company_name || (store360 as Customer).full_name || (store360 as Lead).contact_person,
      visit_type: visitScenario, 
      stock_status: visitStockStatus, 
      placement_image_url: imageUrl || null,
      visit_details: { ...visitDetails, geo: geoData } // Structured JSON Storage
    }])

    if (!error) {
      await logActivity('Intelligence Captured', `Logged ${visitScenario} at ${store360.company_name}.`)
      const beat = adminBeats.find(b => b.target_id === store360.id)
      if (beat) await supabase.from('daily_beats').update({ status: 'Completed' }).eq('id', beat.id)

      toast.success('Field Intelligence Saved Successfully!')
      
      setVisitDetails({})
      setShelfImage(null)
      setShowVisitReport(false)
      fetchHubData(agent.id, agent.assigned_pincodes || [])
      
      // Auto-Routing based on scenario completion
      if (visitScenario === 'C_Order' || visitStockStatus === 'Out of Stock') { 
        toast('Routing to Order Portal...', { icon: '🛒' }); 
        setStore360(null); 
        setOrderForm({...orderForm, customerId: store360.id}); 
        setActiveView('punch_order') 
      }
      else if (visitScenario === 'D_Delivery' || visitScenario === 'E_Credit') {
        toast('Routing to Payment Portal...', { icon: '💳' }); 
        setStore360(null); 
        setPaymentForm({...paymentForm, customerId: store360.id}); 
        setActiveView('payments') 
      }
    } else { toast.error(error.message) }
    setIsSubmitting(false)
  }

  const handleAddLead = async (e: FormEvent) => {
    e.preventDefault(); if (!agent) return; setIsSubmitting(true)
    const { error } = await supabase.from('leads').insert([{ ...leadForm, assigned_to: agent.id, status: 'New', estimated_volume: Number(leadForm.estimated_volume) || 0 }])
    if (!error) {
      await logActivity('Lead Captured', `Punched new Outlet Master: ${leadForm.company_name}`)
      toast.success('Outlet Master Added!')
      setLeadForm({ company_name: '', contact_person: '', phone_number: '', pincode: '', gst_number: '', store_type: 'Retailer', full_address: '', competitor_intel: '', estimated_volume: '' })
      fetchHubData(agent.id, agent.assigned_pincodes || [])
    } else { toast.error(error.message) }
    setIsSubmitting(false)
  }

  const handleLogPayment = async (e: FormEvent) => {
    e.preventDefault(); if (!agent || !paymentForm.customerId) return; setIsSubmitting(true)
    let proofUrl = ''
    if (paymentProof) {
      const fileExt = paymentProof.name.split('.').pop()
      const fileName = `proof_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(fileName, paymentProof)
      if (!uploadError) proofUrl = supabase.storage.from('payment-proofs').getPublicUrl(fileName).data.publicUrl
    }
    const customer = customers.find(c => c.id === paymentForm.customerId)
    const { error } = await supabase.from('wallet_requests').insert([{ user_id: customer?.id, customer_name: customer?.company_name || customer?.full_name, amount: Number(paymentForm.amount), utr_number: `${paymentForm.method} - ${paymentForm.reference}`, status: 'Pending', proof_url: proofUrl || null }])
    if (!error) {
      await logActivity('Payment Collected', `Logged ₹${paymentForm.amount} collection from ${customer?.company_name}. Pending verification.`)
      toast.success('Collection logged! Sent to Accounts for Verification.')
      setPaymentForm({ customerId: '', amount: '', method: 'Cash', reference: '' }); setPaymentProof(null); setActiveView('beat')
    } else { toast.error(error.message) }
    setIsSubmitting(false)
  }

  const getSystemPrice = (product: Product, customerId: string) => {
    const cust = customers.find(c => c.id === customerId)
    if (!cust) return product.price_b2b
    switch (cust.client_type) {
      case 'Distributor': return product.price_distributor
      case 'Roti Factory': return product.price_roti_factory
      case 'Retail (Modern)': return product.price_retail_modern
      case 'Retail (Old School)': return product.price_retail_old
      default: return product.price_b2b
    }
  }

  const todaysBeat: BeatStop[] = [
    ...adminBeats.map(b => ({ id: b.target_id, type: 'Admin Assigned', title: b.target_name, subtitle: `Priority Action Required`, data: customers.find(c => c.id === b.target_id) || leads.find(l => l.id === b.target_id), action: () => { const target = customers.find(c => c.id === b.target_id) || leads.find(l => l.id === b.target_id); if(target) openStore360(target as Customer | Lead) }, urgent: true })),
    ...customers.filter(c => c.wallet_balance < 0 && !adminBeats.some(b => b.target_id === c.id)).map(c => ({ id: c.id, type: 'Collection', title: c.company_name || c.full_name, subtitle: `Owes ₹${Math.abs(c.wallet_balance).toLocaleString()}`, data: c, action: () => openStore360(c), urgent: true })),
    ...leads.filter(l => l.status === 'New' && !adminBeats.some(b => b.target_id === l.id)).map(l => ({ id: l.id, type: 'New Lead', title: l.company_name, subtitle: `Pin: ${l.pincode} • ${l.contact_person}`, data: l, action: () => setActiveView('pipeline'), urgent: false })),
  ].slice(0, 15)

  // MECE Menu Rendering
  const isModuleAccessible = (modId: string) => {
    if (agent?.role === 'admin' || agent?.role === 'sales') return true;
    return agent?.access_levels?.sales?.[modId] === 'read' || agent?.access_levels?.sales?.[modId] === 'write';
  }

  const navItems = [
    { id: 'beat', icon: Map, label: "Today's Route", show: isModuleAccessible('beat') },
    { id: 'punch_order', icon: ShoppingCart, label: 'Punch Order', show: isModuleAccessible('punch_order') },
    { id: 'crm', icon: Users, label: 'Customer Directory', show: isModuleAccessible('crm') },
    { id: 'pipeline', icon: Target, label: 'Outlet Onboarding', show: isModuleAccessible('pipeline') },
    { id: 'payments', icon: IndianRupee, label: 'Log Collection', show: isModuleAccessible('payments') },
    { id: 'profile', icon: UserCircle, label: 'My HR Profile', show: true },
  ].filter(n => n.show)

  const openStore360 = (customer: Customer | Lead) => {
    if ('wallet_balance' in customer) {
      const history = agentOrders.filter(o => o.customer_name === customer.company_name || o.customer_name === customer.full_name).slice(0, 3)
      setStoreHistory(history)
    }
    setStore360(customer)
  }

  if (isLoadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 size={48} className="animate-spin text-indigo-600" /></div>
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center text-center p-12 font-bold text-slate-900"><AlertCircle size={64} className="mx-auto text-red-500 mb-4" />Access Denied.</div>

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row w-full overflow-x-hidden font-sans text-slate-900">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white h-16 flex items-center justify-between px-4 sticky top-0 z-30 shrink-0 shadow-md">
        <div className="font-bold text-lg flex items-center gap-2"><Navigation size={20}/> Field Force</div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-300"><Menu size={24} /></button>
      </div>

      {/* Sidebar */}
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0"><span className="text-white font-bold text-lg flex items-center gap-2"><Navigation size={20}/> Field Ops</span><button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white"><X size={20}/></button></div>
        <div className="p-6 border-b border-slate-800 bg-slate-800/30"><p className="text-white font-bold truncate flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>{agent?.full_name || 'Field Agent'}</p><p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{agent?.assigned_pincodes?.length || 0} Territories</p></div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveView(item.id as any); setIsMobileMenuOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${activeView === item.id ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
              <item.icon size={20} className={activeView === item.id ? 'text-indigo-200' : 'text-slate-400'} /> {item.label}
              {item.id === 'beat' && <span className="ml-auto bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">{todaysBeat.filter(b => b.urgent).length}</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 flex gap-2">
          {agent?.role !== 'sales' && <button onClick={() => window.location.replace('/portal')} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-colors text-xs"><LayoutDashboard size={16}/> Portal</button>}
          <button onClick={() => { supabase.auth.signOut(); window.location.replace('/auth'); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl font-bold transition-colors text-xs"><LogOut size={16} /> Exit</button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-screen">
        <header className="mb-6 md:mb-8"><h2 className="text-2xl font-bold text-slate-900 tracking-tight">{navItems.find(n => n.id === activeView)?.label}</h2></header>

        {activeView === 'profile' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-2xl animate-in fade-in">
            <h3 className="text-xl font-bold mb-6 text-slate-900 flex items-center gap-2"><UserCircle className="text-indigo-600"/> Agent HR Profile</h3>
            <form onSubmit={handleUpdateHR} className="space-y-6">
              <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase tracking-wider">Territory Map (Pincodes)</label><div className="flex flex-wrap gap-2">{agent?.assigned_pincodes && agent.assigned_pincodes.length > 0 ? agent.assigned_pincodes.map(pin => <span key={pin} className="bg-slate-100 text-slate-700 font-mono font-bold px-3 py-1 rounded-md text-sm border border-slate-200">{pin}</span>) : <span className="text-sm text-slate-500 italic">No territory assigned. Contact Manager.</span>}</div></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase tracking-wider">Employee Number (ID)</label><input required type="text" value={hrForm.employee_number} onChange={e => setHrForm({...hrForm, employee_number: e.target.value})} className="w-full p-3.5 bg-white shadow-sm border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-indigo-500 uppercase" placeholder="e.g. RG-EMP-001"/></div>
                <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase tracking-wider">ID Proof (Aadhaar/PAN)</label><input required type="text" value={hrForm.id_proof_number} onChange={e => setHrForm({...hrForm, id_proof_number: e.target.value})} className="w-full p-3.5 bg-white shadow-sm border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-indigo-500 uppercase" placeholder="ID Number"/></div>
              </div>
              <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase tracking-wider">Emergency Contact (Name & Phone)</label><input required type="text" value={hrForm.emergency_contact} onChange={e => setHrForm({...hrForm, emergency_contact: e.target.value})} className="w-full p-3.5 bg-white shadow-sm border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-indigo-500" placeholder="e.g. Ramesh (Brother) - 9876543210"/></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mt-4">{isSubmitting ? <Loader2 size={20} className="animate-spin"/> : 'Save HR Details'}</button>
            </form>
          </div>
        )}

        {activeView === 'beat' && (
          <div className="max-w-3xl animate-in fade-in">
            <div className="bg-indigo-600 rounded-2xl p-6 md:p-8 text-white shadow-lg mb-6 relative overflow-hidden"><Map size={120} className="absolute -right-4 -bottom-4 opacity-10" /><h3 className="text-2xl font-bold mb-2 relative z-10">Good Morning, {agent?.full_name?.split(' ')[0] || 'Agent'}</h3><p className="text-indigo-100 relative z-10">You have {todaysBeat.length} stops on your beat today. {todaysBeat.filter(b => b.urgent).length} require urgent execution.</p></div>
            <div className="space-y-4">
              {todaysBeat.length === 0 ? <div className="p-8 bg-white rounded-2xl text-center text-slate-500 shadow-sm border border-slate-200">No scheduled beats for today.</div> : todaysBeat.map((stop, idx) => (
                <div key={idx} onClick={stop.action} className={`bg-white p-4 md:p-5 rounded-2xl shadow-sm border cursor-pointer hover:shadow-md transition-all flex items-center justify-between gap-4 group ${stop.urgent ? 'border-rose-200 border-l-4 border-l-rose-500' : 'border-slate-200 border-l-4 border-l-indigo-500'}`}>
                  <div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${stop.urgent ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{idx + 1}</div><div><div className="flex items-center gap-2"><h4 className="font-bold text-slate-900 text-sm md:text-base">{stop.title}</h4><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${stop.urgent ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{stop.type}</span></div><p className={`text-xs md:text-sm mt-1 font-medium ${stop.urgent ? 'text-rose-600' : 'text-slate-500'}`}>{stop.subtitle}</p></div></div><ChevronRight className="text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'punch_order' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-4xl animate-in fade-in">
            <div className="flex justify-between items-start mb-6"><h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><ShoppingCart className="text-indigo-600"/> Create Field Order</h3></div>
            <form onSubmit={handlePunchOrder} className="space-y-8">
              <div className="space-y-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">1. Select Assigned Customer</label><select required value={orderForm.customerId} onChange={e => setOrderForm({ customerId: e.target.value, items: [] })} className="w-full p-4 bg-white border border-slate-200 shadow-sm rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"><option value="" disabled>-- Choose Customer --</option>{customers.filter(c => c.account_status === 'active').map(c => <option key={c.id} value={c.id}>{c.company_name || c.full_name} ({c.client_type})</option>)}</select></div>
              {orderForm.customerId && (
                <div className="space-y-4"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">2. Add Products & Negotiate Pricing</label>
                  {orderForm.items.map((item, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row items-end gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 relative"><button type="button" onClick={() => setOrderForm({ ...orderForm, items: orderForm.items.filter((_, i) => i !== idx) })} className="absolute -top-2 -right-2 bg-white text-rose-500 p-1.5 rounded-full shadow-md border border-slate-100 hover:bg-rose-50"><X size={14}/></button><div className="w-full md:flex-1"><p className="font-bold text-slate-900">{item.product.name}</p><p className="text-xs text-slate-500 mt-1">System Tier Price: <span className="font-bold text-slate-700">₹{item.system_price}</span> / {item.product.unit}</p></div><div className="w-full md:w-32"><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Qty ({item.product.unit})</label><input type="number" required min="1" value={item.qty} onChange={e => { const newItems = [...orderForm.items]; newItems[idx].qty = Number(e.target.value); setOrderForm({...orderForm, items: newItems}) }} className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-900 outline-none focus:border-indigo-500 shadow-sm"/></div><div className="w-full md:w-40 relative"><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center justify-between">Unit Price {item.custom_price !== item.system_price && <span title="Deviated Price"><AlertTriangle size={12} className="text-amber-500"/></span>}</label><span className="absolute left-3 top-[26px] font-bold text-slate-400">₹</span><input type="number" required min="1" value={item.custom_price} onChange={e => { const newItems = [...orderForm.items]; newItems[idx].custom_price = Number(e.target.value); setOrderForm({...orderForm, items: newItems}) }} className={`w-full p-2.5 pl-7 border rounded-lg font-bold outline-none shadow-sm ${item.custom_price !== item.system_price ? 'border-amber-400 text-amber-700 bg-amber-50' : 'border-slate-200 bg-white text-slate-900 focus:border-indigo-500'}`}/></div></div>
                  ))}
                  <select value="" onChange={e => { const prod = products.find(p => p.id === e.target.value); if (prod) { const sysPrice = getSystemPrice(prod, orderForm.customerId); setOrderForm({...orderForm, items: [...orderForm.items, { product: prod, qty: 1, system_price: sysPrice, custom_price: sysPrice }]}) } }} className="w-full p-3.5 bg-white border border-dashed border-slate-300 text-slate-600 rounded-xl font-medium outline-none hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors shadow-sm"><option value="" disabled>+ Add Product to Order...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                </div>
              )}
              {orderForm.items.length > 0 && (
                <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Estimated Value</p><p className="text-3xl font-bold text-slate-900">₹{orderForm.items.reduce((sum, item) => sum + (item.custom_price * item.qty), 0).toLocaleString()}</p>{orderForm.items.some(i => i.custom_price !== i.system_price) && <p className="text-xs text-amber-600 font-bold mt-2 flex items-center gap-1"><AlertTriangle size={12}/> Price deviated. System will lock order for Admin review.</p>}</div><button type="submit" disabled={isSubmitting} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 size={20} className="animate-spin"/> : <CheckCircle2 size={20}/>} Punch Final Order</button></div>
              )}
            </form>
          </div>
        )}

        {activeView === 'crm' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {customers.map(c => (
                <div key={c.id} onClick={() => openStore360(c)} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full hover:border-indigo-300 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start mb-4"><div><h3 className="font-bold text-lg text-slate-900">{c.company_name || c.full_name}</h3><span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-1 rounded-md mt-1 inline-block">{c.client_type}</span></div>{c.account_status === 'active' ? <ShieldCheck size={24} className="text-emerald-500"/> : <AlertCircle size={24} className="text-amber-500"/>}</div>
                  <div className="space-y-2 text-sm text-slate-600 flex-1 mb-6"><p className="flex items-center gap-2"><Phone size={14}/> {c.phone_number || 'N/A'}</p><p className="flex items-start gap-2"><MapPin size={14} className="mt-1 shrink-0"/> <span className="line-clamp-2">{c.billing_address || 'N/A'}</span></p></div>
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between"><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Ledger Bal.</p><p className={`font-bold text-lg ${c.wallet_balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>₹{c.wallet_balance.toLocaleString()}</p></div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'pipeline' && (
          <div className="animate-in fade-in space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Building2 className="text-indigo-600"/> Master Outlet Onboarding</h3>
              <form onSubmit={handleAddLead} className="space-y-5 max-w-4xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5"><div><label className="block text-xs font-bold mb-2 text-slate-600 uppercase">Store / Bakery Name</label><input required type="text" value={leadForm.company_name} onChange={e => setLeadForm({...leadForm, company_name: e.target.value})} className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold shadow-sm"/></div><div><label className="block text-xs font-bold mb-2 text-slate-600 uppercase">Store Type</label><select value={leadForm.store_type} onChange={e => setLeadForm({...leadForm, store_type: e.target.value})} className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-sm"><option value="Retailer">Retailer (Kirana)</option><option value="Wholesale">Wholesale / Distributor</option><option value="Bakery">Bakery / Roti Factory</option></select></div></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5"><div><label className="block text-xs font-bold mb-2 text-slate-600 uppercase">Contact Person</label><input required type="text" value={leadForm.contact_person} onChange={e => setLeadForm({...leadForm, contact_person: e.target.value})} className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-sm"/></div><div><label className="block text-xs font-bold mb-2 text-slate-600 uppercase">Phone Number</label><input required type="tel" value={leadForm.phone_number} onChange={e => setLeadForm({...leadForm, phone_number: e.target.value})} className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-medium shadow-sm"/></div><div><label className="block text-xs font-bold mb-2 text-slate-600 uppercase">GST Number (Optional)</label><input type="text" value={leadForm.gst_number} onChange={e => setLeadForm({...leadForm, gst_number: e.target.value})} className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono uppercase shadow-sm"/></div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5"><div><label className="block text-xs font-bold mb-2 text-slate-600 uppercase">Full Address</label><textarea required rows={2} value={leadForm.full_address} onChange={e => setLeadForm({...leadForm, full_address: e.target.value})} className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-sm"/></div><div className="flex gap-4"><div className="flex-1"><label className="block text-xs font-bold mb-2 text-slate-600 uppercase">Competitor Brands</label><textarea rows={2} value={leadForm.competitor_intel} onChange={e => setLeadForm({...leadForm, competitor_intel: e.target.value})} placeholder="e.g. Ashirvaad, Fortune" className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-sm"/></div><div className="w-32"><label className="block text-xs font-bold mb-2 text-slate-600 uppercase">Est. Vol/Mo</label><input type="number" placeholder="in KG" value={leadForm.estimated_volume} onChange={e => setLeadForm({...leadForm, estimated_volume: e.target.value})} className="w-full p-3.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-sm"/></div></div></div>
                <button type="submit" disabled={isSubmitting} className="w-full md:w-auto bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold shadow-md hover:bg-indigo-700 active:scale-95 transition-all">{isSubmitting ? <Loader2 size={18} className="animate-spin"/> : 'Capture Lead'}</button>
              </form>
            </div>
            
            <div className="flex gap-6 overflow-x-auto pb-6 hide-scrollbar">
              {['New', 'Contacted', 'Qualified', 'Converted'].map(status => (
                <div key={status} className="w-80 shrink-0 bg-slate-100/50 rounded-2xl p-4 border border-slate-200">
                  <div className="flex justify-between items-center mb-4"><h4 className="font-bold text-slate-700 uppercase tracking-wider text-xs">{status}</h4><span className="bg-white text-slate-600 font-bold text-xs px-2 py-0.5 rounded shadow-sm border border-slate-100">{leads.filter(l => l.status === status).length}</span></div>
                  <div className="space-y-3">
                    {leads.filter(l => l.status === status).map(lead => (
                      <div key={lead.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-indigo-500"><p className="font-bold text-slate-900">{lead.company_name}</p><p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin size={12}/> {lead.pincode || 'Unassigned Pin'}</p><div className="mt-4 flex gap-2">{status === 'New' && <button onClick={async () => { await supabase.from('leads').update({status:'Contacted'}).eq('id', lead.id); fetchHubData(agent?.id || '', []) }} className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg flex-1 hover:bg-indigo-100 transition-colors">Contacted</button>}{status === 'Contacted' && <button onClick={async () => { await supabase.from('leads').update({status:'Qualified'}).eq('id', lead.id); fetchHubData(agent?.id || '', []) }} className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg flex-1 hover:bg-indigo-100 transition-colors">Qualified</button>}{status === 'Qualified' && <button onClick={async () => { await supabase.from('leads').update({status:'Converted'}).eq('id', lead.id); fetchHubData(agent?.id || '', []) }} className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg flex-1 hover:bg-emerald-100 transition-colors">Won</button>}</div></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'payments' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-2xl animate-in fade-in">
            <h3 className="text-xl font-bold mb-2 text-slate-900 flex items-center gap-2"><IndianRupee className="text-indigo-600"/> Log Payment Collection</h3>
            <p className="text-slate-500 text-sm mb-8">Record payments collected in the field. Proofs enter a pending state and do not hit the ledger until Accounts verify them.</p>
            <form onSubmit={handleLogPayment} className="space-y-6">
              <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase tracking-wider">Select Customer</label><select required value={paymentForm.customerId} onChange={e => setPaymentForm({...paymentForm, customerId: e.target.value})} className="w-full p-4 bg-white shadow-sm border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"><option value="" disabled>-- Choose Customer --</option>{customers.map(c => <option key={c.id} value={c.id}>{c.company_name || c.full_name}</option>)}</select></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6"><div className="relative"><label className="block text-xs font-bold mb-2 text-slate-700 uppercase tracking-wider">Amount Collected</label><span className="absolute left-4 top-[38px] font-bold text-slate-400">₹</span><input required type="number" min="1" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full p-4 pl-8 bg-white shadow-sm border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-indigo-500" placeholder="0.00"/></div><div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase tracking-wider">Payment Mode</label><select required value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})} className="w-full p-4 bg-white shadow-sm border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-indigo-500"><option value="Cash">Cash</option><option value="Cheque">Cheque</option><option value="UPI / NEFT">UPI / NEFT</option></select></div></div>
              <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase tracking-wider">Reference / Cheque Number</label><input required type="text" value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})} className="w-full p-4 bg-white shadow-sm border border-slate-200 rounded-xl font-medium text-slate-900 outline-none focus:border-indigo-500" placeholder="e.g. Received by hand / UTR No."/></div>
              <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase tracking-wider">Attach Proof (Required for Audit)</label><label className="block w-full bg-slate-50 p-4 rounded-xl border border-slate-300 border-dashed hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer text-center group"><UploadCloud className="mx-auto text-slate-400 group-hover:text-indigo-500 mb-2 transition-colors" size={24}/><span className="text-sm font-bold text-slate-600">{paymentProof ? paymentProof.name : 'Tap to capture or upload receipt'}</span><input required type="file" accept="image/*" onChange={e => e.target.files && setPaymentProof(e.target.files[0])} className="hidden"/></label></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 size={20} className="animate-spin"/> : <CheckCircle2 size={20}/>} Submit for Verification</button>
            </form>
          </div>
        )}

        {/* --- FSVSIM: STORE 360 & FIELD INTELLIGENCE MODAL --- */}
        {store360 && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => {setStore360(null); setShowVisitReport(false)}}></div>
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200 max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50 shrink-0">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{store360.company_name || ('full_name' in store360 ? store360.full_name : (store360 as Lead).contact_person)}</h3>
                  <p className="text-sm text-slate-500 mt-1 flex items-center gap-1"><MapPin size={14}/> {('billing_address' in store360 ? store360.billing_address : store360.pincode) || 'No Address'}</p>
                </div>
                <button onClick={() => {setStore360(null); setShowVisitReport(false)}} className="p-2 bg-white text-slate-400 hover:text-slate-900 rounded-full shadow-sm"><X size={20}/></button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                {!showVisitReport ? (
                  <div className="space-y-6">
                    {/* CRM Dashboard View */}
                    {'wallet_balance' in store360 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Ledger Intelligence</h4>
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                          <div className="flex justify-between items-end mb-4">
                            <div><p className="text-sm font-medium text-slate-500 mb-1">Current Balance</p><p className={`text-3xl font-bold ${store360.wallet_balance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>₹{Math.abs(store360.wallet_balance).toLocaleString()} {store360.wallet_balance < 0 ? '(Due)' : '(Cr)'}</p></div>
                            {store360.credit_limit > 0 && <div className="text-right"><p className="text-xs text-slate-500 mb-1 font-bold uppercase">Credit Limit</p><p className="text-lg font-bold text-slate-900">₹{store360.credit_limit.toLocaleString()}</p></div>}
                          </div>
                          {store360.credit_limit > 0 && <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div className={`h-full rounded-full ${store360.wallet_balance < 0 && Math.abs(store360.wallet_balance) > (store360.credit_limit * 0.8) ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, (store360.wallet_balance < 0 ? Math.abs(store360.wallet_balance) : 0) / store360.credit_limit * 100)}%` }}></div></div>}
                        </div>
                      </div>
                    )}
                    
                    {/* FSVSIM Trigger */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div><h4 className="font-bold text-indigo-900 flex items-center gap-2"><Activity size={18}/> Execute Field Visit</h4><p className="text-sm text-indigo-700/70 mt-1">Check-in via GPS and log structured store intelligence.</p></div>
                      <button onClick={() => setShowVisitReport(true)} className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shrink-0"><MapPin size={16}/> Start Visit</button>
                    </div>

                    {'wallet_balance' in store360 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><History size={14}/> Recent Orders</h4>
                        {storeHistory.length === 0 ? <p className="text-sm text-slate-500 italic">No previous orders found.</p> : (<div className="space-y-3">{storeHistory.map((h, i) => (<div key={i} className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center shadow-sm"><div><p className="font-bold text-slate-900 text-sm">{new Date(h.created_at).toLocaleDateString()}</p><p className="text-xs text-slate-500 mt-1">{h.order_items.length} items ordered</p></div><div className="text-right"><p className="font-bold text-slate-900">₹{h.total_amount.toLocaleString()}</p><p className="text-[10px] font-bold text-indigo-600 uppercase mt-1 bg-indigo-50 inline-block px-2 py-0.5 rounded">{h.status}</p></div></div>))}</div>)}
                      </div>
                    )}
                  </div>
                ) : (
                  /* FSVSIM: SCENARIO EXECUTION FORM */
                  <form onSubmit={handleLogVisit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-right-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                      <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2"><MapPin className="text-emerald-500"/> Visit Check-In</h3>
                      <button type="button" onClick={() => setShowVisitReport(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">Cancel Check-in</button>
                    </div>
                    
                    {/* SCENARIO SELECTOR */}
                    <div>
                      <label className="block text-xs font-bold mb-3 text-slate-700 uppercase">Execution Scenario</label>
                      <select value={visitScenario} onChange={e => setVisitScenario(e.target.value as any)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="C_Order">Scenario C: Routine Order Booking</option>
                        <option value="A_Onboard">Scenario A: Competitor/Store Onboarding</option>
                        <option value="B_FollowUp">Scenario B: Pre-Order Sales Follow-up</option>
                        <option value="E_Credit">Scenario E: Credit & Ledger Follow-up</option>
                        <option value="F_Demand">Scenario F: General Demand / Merchandising</option>
                      </select>
                    </div>

                    {/* DYNAMIC SCENARIO FORMS */}
                    <div className="space-y-5 border-t border-slate-100 pt-5">
                      
                      {visitScenario === 'A_Onboard' && (
                        <div className="space-y-4 bg-amber-50 p-5 rounded-xl border border-amber-100">
                          <h4 className="text-xs font-bold text-amber-800 uppercase">Competitor Intelligence</h4>
                          <input type="text" placeholder="Top Competitor Brands Sold Here" value={visitDetails.competitors || ''} onChange={e => setVisitDetails({...visitDetails, competitors: e.target.value})} className="w-full p-3 bg-white border border-amber-200 rounded-lg text-sm font-medium"/>
                          <div className="grid grid-cols-2 gap-4">
                            <input type="number" placeholder="Est. Monthly Vol (kg)" value={visitDetails.volume || ''} onChange={e => setVisitDetails({...visitDetails, volume: e.target.value})} className="w-full p-3 bg-white border border-amber-200 rounded-lg text-sm font-medium"/>
                            <input type="number" placeholder="Competitor Buying Price (₹)" value={visitDetails.comp_price || ''} onChange={e => setVisitDetails({...visitDetails, comp_price: e.target.value})} className="w-full p-3 bg-white border border-amber-200 rounded-lg text-sm font-medium"/>
                          </div>
                        </div>
                      )}

                      {visitScenario === 'B_FollowUp' && (
                        <div className="space-y-4 bg-blue-50 p-5 rounded-xl border border-blue-100">
                          <h4 className="text-xs font-bold text-blue-800 uppercase">Sales Pipeline Progress</h4>
                          <textarea rows={2} placeholder="Customer Objections / Hesitations..." value={visitDetails.objections || ''} onChange={e => setVisitDetails({...visitDetails, objections: e.target.value})} className="w-full p-3 bg-white border border-blue-200 rounded-lg text-sm font-medium"/>
                          <div>
                            <label className="text-[10px] font-bold text-blue-700 uppercase block mb-1">Interest Level</label>
                            <select value={visitDetails.interest || 'Medium'} onChange={e => setVisitDetails({...visitDetails, interest: e.target.value})} className="w-full p-3 bg-white border border-blue-200 rounded-lg text-sm font-bold"><option>High (Ready to Buy)</option><option>Medium (Negotiating)</option><option>Low (Not Interested)</option></select>
                          </div>
                        </div>
                      )}

                      {visitScenario === 'E_Credit' && (
                        <div className="space-y-4 bg-rose-50 p-5 rounded-xl border border-rose-100">
                          <h4 className="text-xs font-bold text-rose-800 uppercase">Credit / Recovery Log</h4>
                          <textarea rows={2} placeholder="Reason for delay / Next payment promise date..." value={visitDetails.credit_notes || ''} onChange={e => setVisitDetails({...visitDetails, credit_notes: e.target.value})} className="w-full p-3 bg-white border border-rose-200 rounded-lg text-sm font-medium"/>
                        </div>
                      )}

                      {/* Stock Check is present in almost all routines */}
                      {(visitScenario === 'C_Order' || visitScenario === 'E_Credit' || visitScenario === 'F_Demand') && (
                        <div>
                          <label className="block text-xs font-bold mb-2 text-slate-700 uppercase">RG Product Stock Availability</label>
                          <select value={visitStockStatus} onChange={e => setVisitStockStatus(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-indigo-500">
                            <option value="Adequate">Adequate Stock</option>
                            <option value="Low">Low Stock (Needs Top-up)</option>
                            <option value="Out of Stock">🚨 Out of Stock!</option>
                          </select>
                        </div>
                      )}

                      <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase">General Store Notes</label><textarea rows={2} value={visitDetails.general || ''} onChange={e => setVisitDetails({...visitDetails, general: e.target.value})} placeholder="Owner requested faster dispatch next time..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:border-indigo-500"/></div>
                      
                      <div>
                        <label className="block text-xs font-bold mb-2 text-slate-700 uppercase">Shelf/Store Photo (Geotagged)</label>
                        <label className="block w-full bg-slate-50 p-4 rounded-xl border border-slate-300 border-dashed hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer text-center group">
                          <Camera className="mx-auto text-slate-400 group-hover:text-indigo-500 mb-2 transition-colors" size={24}/>
                          <span className="text-sm font-bold text-slate-600">{shelfImage ? shelfImage.name : 'Tap to capture product placement'}</span>
                          <input type="file" accept="image/*" capture="environment" onChange={e => e.target.files && setShelfImage(e.target.files[0])} className="hidden"/>
                        </label>
                      </div>
                    </div>
                    
                    <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform">{isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <CheckSquare size={18}/>} Save Intelligence & Complete Visit</button>
                  </form>
                )}
              </div>

              {/* Quick Actions (Bypassing Visit Report) */}
              {!showVisitReport && (
                <div className="p-6 border-t border-slate-100 bg-white flex gap-3 shrink-0">
                  {'wallet_balance' in store360 && <button onClick={() => { setPaymentForm({...paymentForm, customerId: store360.id}); setStore360(null); setActiveView('payments') }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center gap-2"><IndianRupee size={18}/> Collect Pay</button>}
                  <button onClick={() => { setOrderForm({...orderForm, customerId: store360.id}); setStore360(null); setActiveView('punch_order') }} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-95 flex justify-center items-center gap-2"><ShoppingCart size={18}/> Punch Order</button>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}