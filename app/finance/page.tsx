'use client'

import { useEffect, useState, FormEvent, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  Banknote, BarChart3, ClipboardList, Users, Check, X, 
  AlertTriangle, Calculator, Save, ShieldCheck, UserCircle, 
  Loader2, LogOut, Menu, TrendingUp, TrendingDown, ShieldAlert, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

// --- Interfaces ---
type AccessLevel = 'none' | 'read' | 'write'
interface ModuleAccess { _master: AccessLevel; [subTab: string]: AccessLevel; }
interface AccessMatrix { [module: string]: ModuleAccess; }

interface UserProfile { id: string; full_name: string; email: string; role: string; employee_number?: string; emergency_contact?: string; id_proof_number?: string; access_levels?: AccessMatrix; temporary_access?: Record<string, string>; }
interface UserRole { id: string; full_name: string; company_name: string; email: string; role: string; client_type: string; account_status: string; wallet_balance: number; credit_limit: number; created_at: string; phone_number?: string; }
interface OrderItem { id: string; name: string; price: number; unit: string; quantity: number; }
interface Order { id: string; user_id: string; customer_name: string; total_amount: number; status: string; created_at: string; order_items: OrderItem[]; is_price_deviated?: boolean; }
interface WalletRequest { id: string; user_id: string; customer_name: string; amount: number; utr_number: string; status: string; proof_url?: string; created_at: string; }
interface Product { id: string; name: string; category: string; }
interface CostStructure { id?: string; product_id: string; raw_material_cost: number; processing_cost: number; packaging_cost: number; base_logistics_cost: number; target_margin_percent: number; min_margin_percent: number; }
interface TrustScore { id: string; customer_id: string; base_score: number; late_payment_count: number; bounced_cheque_count: number; successful_order_count: number; }

export default function FinanceHub() {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [manager, setManager] = useState<UserProfile | null>(null)
  
  const [activeView, setActiveView] = useState<'b2b_orders' | 'finance' | 'pricing' | 'approvals' | 'trust' | 'profile'>('b2b_orders')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [orders, setOrders] = useState<Order[]>([])
  const [pendingClients, setPendingClients] = useState<UserRole[]>([])
  const [walletRequests, setWalletRequests] = useState<WalletRequest[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [costStructures, setCostStructures] = useState<CostStructure[]>([])
  const [allUsers, setAllUsers] = useState<UserRole[]>([])
  const [trustScores, setTrustScores] = useState<TrustScore[]>([])

  const [hrForm, setHrForm] = useState({ employee_number: '', emergency_contact: '', id_proof_number: '' })
  const [negotiatingOrder, setNegotiatingOrder] = useState<Order | null>(null)
  const [negoForm, setNegoForm] = useState({ freight: 0, toll: 0, loading: 0, packaging: 0, gateway: 0, other: 0, payment_terms: '100% Advance' })
  const [costForm, setCostForm] = useState<CostStructure>({ product_id: '', raw_material_cost: 0, processing_cost: 0, packaging_cost: 0, base_logistics_cost: 0, target_margin_percent: 15, min_margin_percent: 5 })
  const [selectedProof, setSelectedProof] = useState<string | null>(null)

  const fetchFinanceData = useCallback(async () => {
    const { data: orderData } = await supabase.from('orders').select('*').eq('status', 'Pending Approval').order('created_at', { ascending: false })
    if (orderData) setOrders(orderData as Order[])

    const { data: walletData } = await supabase.from('wallet_requests').select('*').eq('status', 'Pending').order('created_at', { ascending: false })
    if (walletData) setWalletRequests(walletData as WalletRequest[])

    const { data: kycData } = await supabase.from('user_roles').select('*').eq('account_status', 'pending').eq('role', 'customer')
    if (kycData) setPendingClients(kycData as UserRole[])

    const { data: prodData } = await supabase.from('products').select('id, name, category').order('name', { ascending: true })
    if (prodData) setProducts(prodData as Product[])
    
    const { data: costData } = await supabase.from('cost_structures').select('*')
    if (costData) setCostStructures(costData as CostStructure[])

    const { data: usersData } = await supabase.from('user_roles').select('*')
    if (usersData) setAllUsers(usersData as UserRole[])

    const { data: trustData } = await supabase.from('trust_scores').select('*')
    if (trustData) setTrustScores(trustData as TrustScore[])
  }, [])

  useEffect(() => {
    let isMounted = true
    const initFinance = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return window.location.replace('/auth')
      const { data: roleData } = await supabase.from('user_roles').select('*').eq('id', session.user.id).single()
      
      const now = new Date();
      const hasPass = roleData?.temporary_access?.finance && new Date(roleData.temporary_access.finance) > now;
      const hasMatrixRead = roleData?.access_levels?.finance?._master === 'read' || roleData?.access_levels?.finance?._master === 'write';
      
      if (roleData?.role === 'finance' || roleData?.role === 'admin' || hasPass || hasMatrixRead) {
        if (isMounted) {
          setIsAuthorized(true)
          setManager(roleData as UserProfile)
          setHrForm({ employee_number: roleData.employee_number || '', emergency_contact: roleData.emergency_contact || '', id_proof_number: roleData.id_proof_number || '' })
          fetchFinanceData()
        }
      } else { window.location.replace('/portal') }
      
      if (isMounted) setIsLoadingAuth(false)
    }
    initFinance()
    return () => { isMounted = false }
  }, [fetchFinanceData])

  const isModuleAccessible = (modId: string) => {
    if (manager?.role === 'admin' || manager?.role === 'finance') return true;
    return manager?.access_levels?.finance?.[modId] === 'read' || manager?.access_levels?.finance?.[modId] === 'write';
  }

  const handleUpdateHR = async (e: FormEvent) => {
    e.preventDefault(); if (!manager) return; setIsSubmitting(true)
    const { error } = await supabase.from('user_roles').update(hrForm).eq('id', manager.id)
    if (!error) { toast.success('Profile Updated!'); setManager({ ...manager, ...hrForm }) } else { toast.error(error.message) }
    setIsSubmitting(false)
  }

  const handleApproveB2BOrder = async (e: FormEvent) => {
    e.preventDefault(); if (!negotiatingOrder) return; setIsSubmitting(true)
    const total = Number(negotiatingOrder.total_amount) + Number(negoForm.freight) + Number(negoForm.toll) + Number(negoForm.loading) + Number(negoForm.packaging) + Number(negoForm.gateway) + Number(negoForm.other)
    
    const { error } = await supabase.from('orders').update({ 
      status: 'Processing (Milling)', 
      total_amount: total, freight_charges: negoForm.freight, toll_charges: negoForm.toll, 
      loading_charges: negoForm.loading, packaging_charges: negoForm.packaging, 
      gateway_charges: negoForm.gateway, other_charges: negoForm.other, payment_terms: negoForm.payment_terms 
    }).eq('id', negotiatingOrder.id)
    
    if (!error) { 
      toast.success('B2B Quote Approved & Sent to Dispatch!')
      const phone = allUsers.find(u => u.id === negotiatingOrder.user_id)?.phone_number || ''
      if(phone) window.open(`https://wa.me/91${phone.replace(/\D/g,'').slice(-10)}?text=${encodeURIComponent('Your B2B Order has been approved. Payment Terms: '+negoForm.payment_terms+'. Final Total: ₹'+total.toLocaleString())}`, '_blank')
      setNegotiatingOrder(null); fetchFinanceData() 
    } else { toast.error(error.message) }
    setIsSubmitting(false)
  }

  const approveWalletRequest = async (id: string, uid: string, amt: number) => {
    setIsSubmitting(true)
    const user = allUsers.find(u => u.id === uid)
    const currentBalance = user?.wallet_balance || 0
    
    const { error: userError } = await supabase.from('user_roles').update({ wallet_balance: currentBalance + amt }).eq('id', uid)
    if (userError) { toast.error(userError.message); setIsSubmitting(false); return; }

    const { error: reqError } = await supabase.from('wallet_requests').update({ status: 'Approved' }).eq('id', id)
    if (!reqError) { toast.success(`Ledger Credited by ₹${amt.toLocaleString()}!`); fetchFinanceData() } 
    else { toast.error(reqError.message) }
    setIsSubmitting(false)
  }

  const handleApprovalAction = async (id: string, status: string) => {
    setIsSubmitting(true); const { error } = await supabase.from('user_roles').update({ account_status: status }).eq('id', id)
    if (!error) { toast.success(`Client ${status}!`); fetchFinanceData() } else { toast.error(error.message) }
    setIsSubmitting(false)
  }

  const handleSaveCostStructure = async (e: FormEvent) => {
    e.preventDefault(); setIsSubmitting(true)
    const payload = { ...costForm }; delete payload.id;
    const exists = costStructures.some(cs => cs.product_id === costForm.product_id)
    const { error } = exists ? await supabase.from('cost_structures').update(payload).eq('product_id', costForm.product_id) : await supabase.from('cost_structures').insert([payload])
    if (!error) { toast.success('Cost Guardrails Saved!'); fetchFinanceData() } else { toast.error(error.message) }
    setIsSubmitting(false)
  }

  const adjustTrustScore = async (customerId: string, adjustment: number, type: 'bonus' | 'penalty') => {
    const existing = trustScores.find(t => t.customer_id === customerId);
    const newScore = Math.min(100, Math.max(0, (existing?.base_score || 100) + adjustment));
    
    const payload: any = { customer_id: customerId, base_score: newScore, last_recalculated: new Date().toISOString() };
    if (type === 'penalty') payload.late_payment_count = (existing?.late_payment_count || 0) + 1;

    const { error } = existing 
      ? await supabase.from('trust_scores').update(payload).eq('id', existing.id)
      : await supabase.from('trust_scores').insert([payload]);

    if (!error) { toast.success(`Trust Score updated to ${newScore}`); fetchFinanceData() } 
    else { toast.error(error.message) }
  }

  const navItems = [
    { id: 'b2b_orders', icon: ClipboardList, label: 'B2B Quotes', badge: orders.length, show: isModuleAccessible('b2b_orders') },
    { id: 'finance', icon: Banknote, label: 'Ledger Verification', badge: walletRequests.length, show: isModuleAccessible('finance') },
    { id: 'pricing', icon: BarChart3, label: 'DPMIE Margin Engine', show: isModuleAccessible('pricing') },
    { id: 'trust', icon: ShieldAlert, label: 'Risk & Trust Governance', show: isModuleAccessible('trust') },
    { id: 'approvals', icon: Users, label: 'KYC Activations', badge: pendingClients.length, show: isModuleAccessible('approvals') },
    { id: 'profile', icon: UserCircle, label: 'My HR Profile', show: true },
  ].filter(n => n.show)

  if (isLoadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 size={48} className="animate-spin text-indigo-600" /></div>
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center text-center p-12 font-bold text-slate-900"><AlertCircle size={64} className="mx-auto text-red-500 mb-4" />Finance Access Required.</div>

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row w-full overflow-x-hidden text-slate-900 font-sans">
      <div className="md:hidden bg-slate-900 text-white h-16 flex items-center justify-between px-4 sticky top-0 z-30 shrink-0 shadow-md"><div className="font-bold text-lg flex items-center gap-2"><Banknote size={20}/> Finance Ops</div><button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-300"><Menu size={24} /></button></div>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0"><span className="text-white font-bold text-lg flex items-center gap-2"><ShieldCheck size={20} className="text-emerald-400"/> Finance</span><button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white"><X size={20}/></button></div>
        <div className="p-6 border-b border-slate-800 bg-slate-800/30"><p className="text-white font-bold truncate">{manager?.full_name || 'Manager'}</p><p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{manager?.employee_number || 'ID Pending'}</p></div>
        <nav className="flex-1 px-4 py-6 space-y-2">{navItems.map(item => (<button key={item.id} onClick={() => { setActiveView(item.id as any); setIsMobileMenuOpen(false) }} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-sm ${activeView === item.id ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}><div className="flex items-center gap-3"><item.icon size={20} className={activeView === item.id ? 'text-indigo-200' : 'text-slate-400'} /> {item.label}</div>{item.badge && item.badge > 0 && <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{item.badge}</span>}</button>))}</nav>
        <div className="p-4 border-t border-slate-800 flex gap-2">{manager?.role !== 'finance' && <button onClick={() => window.location.replace('/portal')} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-colors text-xs"><BarChart3 size={16}/> Portal</button>}<button onClick={() => { supabase.auth.signOut(); window.location.replace('/auth'); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl font-bold transition-colors text-xs"><LogOut size={16} /> Exit</button></div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-screen">
        <header className="mb-6 md:mb-8"><h2 className="text-2xl font-bold text-slate-900 tracking-tight">{navItems.find(n => n.id === activeView)?.label}</h2></header>

        {activeView === 'b2b_orders' && (
          <div className="space-y-4 animate-in fade-in">
            {orders.length === 0 ? <div className="p-12 bg-white rounded-3xl text-center text-slate-500 border border-slate-200 shadow-sm"><ShieldCheck size={48} className="mx-auto text-emerald-200 mb-4"/><p className="font-bold text-slate-700 text-lg">All Quotes Approved!</p></div> : orders.map(order => (
              <div key={order.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col lg:flex-row items-start lg:items-center justify-between shadow-sm gap-6"><div className="w-full lg:w-auto"><div className="font-bold text-xl text-slate-900 flex items-center gap-3">{order.customer_name} {order.is_price_deviated && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={12}/> Agent Deviation</span>}</div><div className="text-indigo-700 font-mono text-sm bg-indigo-50 px-3 py-1 rounded-md inline-block mt-3 border border-indigo-100">Order #{order.id.split('-')[0].toUpperCase()}</div></div><div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full lg:w-auto gap-6 pt-4 lg:pt-0 border-t border-slate-100 lg:border-t-0"><div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Base Materials Total</p><p className="text-3xl font-bold text-slate-900">₹{order.total_amount.toLocaleString()}</p></div><button onClick={() => { setNegotiatingOrder(order); setNegoForm({ freight: 0, toll: 0, loading: 0, packaging: 0, gateway: 0, other: 0, payment_terms: '100% Advance' }); }} className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md active:scale-95"><Calculator size={18}/> Review & Quote</button></div></div>
            ))}
          </div>
        )}

        {activeView === 'finance' && (
          <div className="space-y-4 animate-in fade-in">
            {walletRequests.length === 0 ? <div className="p-12 bg-white rounded-3xl text-center text-slate-500 border border-slate-200 shadow-sm"><Banknote size={48} className="mx-auto text-emerald-200 mb-4"/><p className="font-bold text-slate-700 text-lg">Ledgers Up to Date</p></div> : walletRequests.map(req => (
              <div key={req.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm gap-6"><div className="w-full md:w-auto"><div className="font-bold text-lg text-slate-900">{req.customer_name}</div><div className="text-slate-600 font-mono text-xs bg-slate-100 px-3 py-1.5 rounded-md inline-block mt-2 font-bold border border-slate-200">Ref: {req.utr_number}</div></div><div className="flex flex-col sm:flex-row items-center w-full md:w-auto gap-4 pt-4 md:pt-0 border-t border-slate-100 md:border-t-0"><div className="text-3xl font-bold text-emerald-600">₹{req.amount.toLocaleString()}</div><div className="flex gap-2 w-full sm:w-auto">{req.proof_url && <button onClick={() => setSelectedProof(req.proof_url!)} className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold text-sm">View Proof</button>}<button onClick={() => approveWalletRequest(req.id, req.user_id, req.amount)} disabled={isSubmitting} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-md active:scale-95 flex items-center justify-center gap-2"><Check size={18}/> Verify</button></div></div></div>
            ))}
          </div>
        )}

        {activeView === 'trust' && (
          <div className="space-y-6 animate-in fade-in max-w-6xl">
            <div className="bg-white p-6 md:p-8 rounded-3xl border shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2"><ShieldAlert className="text-indigo-600"/> Risk & Trust Governance</h3>
              <p className="text-sm text-slate-500 mb-8 max-w-3xl">Manage the Trust Score (0-100) for your B2B partners. Scores &gt; 90 automatically grant a 1% bonus discount via DPMIE. Scores &lt; 50 automatically strip away volume discounts to protect margins.</p>
              <div className="grid grid-cols-1 gap-4">
                {allUsers.filter(u => u.client_type !== 'D2C' && u.role === 'customer').map(client => {
                  const scoreRecord = trustScores.find(t => t.customer_id === client.id);
                  const currentScore = scoreRecord?.base_score || 100;
                  const lateCount = scoreRecord?.late_payment_count || 0;
                  let statusColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                  if (currentScore < 50) statusColor = 'bg-rose-100 text-rose-700 border-rose-200';
                  else if (currentScore < 80) statusColor = 'bg-amber-100 text-amber-700 border-amber-200';

                  return (
                    <div key={client.id} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-sm transition-shadow">
                      <div className="w-full md:w-1/3"><h4 className="font-bold text-slate-900 text-lg">{client.company_name || client.full_name}</h4><div className="flex items-center gap-3 mt-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{client.client_type}</span><span className="text-xs font-bold text-slate-500">Owes: <span className={(client.wallet_balance || 0) < 0 ? 'text-rose-600' : ''}>₹{(client.wallet_balance || 0).toLocaleString()}</span></span></div></div>
                      <div className="w-full md:w-1/3 flex items-center md:justify-center gap-6"><div className="text-center"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Trust Score</p><div className={`text-2xl font-black px-4 py-1 rounded-xl border ${statusColor}`}>{currentScore}</div></div><div className="text-center"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Late Payments</p><div className="text-xl font-bold text-slate-700">{lateCount}</div></div></div>
                      <div className="w-full md:w-auto flex flex-wrap gap-2 justify-end"><button onClick={() => adjustTrustScore(client.id, 10, 'bonus')} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 border border-emerald-200"><TrendingUp size={14}/> Reward (+10)</button><button onClick={() => adjustTrustScore(client.id, -15, 'penalty')} className="bg-rose-50 text-rose-700 hover:bg-rose-100 px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 border border-rose-200"><TrendingDown size={14}/> Log Late Pay (-15)</button></div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {activeView === 'pricing' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-white p-6 md:p-8 rounded-3xl border shadow-sm max-w-6xl"><h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><BarChart3 className="text-indigo-600"/> DPMIE Cost Control Engine</h3><p className="text-sm text-slate-500 mb-8">Define foundational manufacturing and logistics costs to dynamically enforce margin boundaries across the field sales team.</p><div className="grid grid-cols-1 lg:grid-cols-3 gap-8"><div className="lg:col-span-1 border-r border-slate-100 pr-6"><label className="block text-xs font-bold mb-3 text-slate-700 uppercase">Select Catalog Item</label><div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 hide-scrollbar">{products.map(p => { const hasConfig = costStructures.some(cs => cs.product_id === p.id); return (<div key={p.id} onClick={() => { const cs = costStructures.find(c => c.product_id === p.id); if(cs) setCostForm(cs); else setCostForm({ product_id: p.id, raw_material_cost: 0, processing_cost: 0, packaging_cost: 0, base_logistics_cost: 0, target_margin_percent: 15, min_margin_percent: 5 }) }} className={`p-4 rounded-2xl border cursor-pointer transition-all ${costForm.product_id === p.id ? 'border-indigo-500 bg-indigo-50 shadow-sm scale-[1.02]' : 'border-slate-200 hover:bg-slate-50'}`}><p className="font-bold text-sm text-slate-900 leading-tight">{p.name}</p><p className="text-[10px] font-bold mt-2 uppercase tracking-wider">{hasConfig ? <span className="text-emerald-600 flex items-center gap-1"><Check size={12}/> Configured</span> : <span className="text-amber-500 flex items-center gap-1"><AlertCircle size={12}/> Missing Config</span>}</p></div>) })}</div></div><div className="lg:col-span-2">{costForm.product_id ? (<form onSubmit={handleSaveCostStructure} className="space-y-8 animate-in fade-in"><div className="bg-slate-50 border border-slate-200 rounded-2xl p-6"><h4 className="text-sm font-bold text-slate-800 mb-5 uppercase tracking-wider">1. Base Costs (Per Unit)</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-5"><div className="relative"><label className="block text-xs font-bold text-slate-600 mb-1">Raw Material</label><span className="absolute left-3 top-7 text-slate-400 font-bold">₹</span><input required type="number" step="0.01" value={costForm.raw_material_cost} onChange={e => setCostForm({...costForm, raw_material_cost: Number(e.target.value)})} className="w-full pl-7 p-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 shadow-sm"/></div><div className="relative"><label className="block text-xs font-bold text-slate-600 mb-1">Processing / Milling</label><span className="absolute left-3 top-7 text-slate-400 font-bold">₹</span><input required type="number" step="0.01" value={costForm.processing_cost} onChange={e => setCostForm({...costForm, processing_cost: Number(e.target.value)})} className="w-full pl-7 p-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 shadow-sm"/></div></div></div><div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6"><button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 size={20} className="animate-spin"/> : <Save size={20}/>} Save Config</button></div></form>) : (<div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl"><Calculator size={48} className="mb-4 opacity-50"/><p className="font-bold text-slate-500">Select a product from the catalog</p></div>)}</div></div></div>
          </div>
        )}

        {activeView === 'approvals' && (
          <div className="space-y-4 animate-in fade-in">
            {pendingClients.length === 0 ? <div className="p-12 bg-white rounded-3xl text-center text-slate-500 border border-slate-200 font-medium">No pending KYC approvals.</div> : pendingClients.map(client => (<div key={client.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm gap-4"><div><div className="font-bold text-lg text-slate-900">{client.company_name}</div></div><div className="flex gap-3"><button onClick={() => handleApprovalAction(client.id, 'active')} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2"><Check size={18}/> Approve</button></div></div>))}
          </div>
        )}

        {activeView === 'profile' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-2xl animate-in fade-in">
            <h3 className="text-xl font-bold mb-6 text-slate-900 flex items-center gap-2"><UserCircle className="text-indigo-600"/> Finance Profile</h3>
            <form onSubmit={handleUpdateHR} className="space-y-6"><button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold shadow-md">{isSubmitting ? <Loader2 size={20} className="animate-spin"/> : 'Save Profile Details'}</button></form>
          </div>
        )}

      </main>

      {/* --- PROOF MODAL --- */}
      {selectedProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setSelectedProof(null)}></div>
          <div className="relative bg-white rounded-2xl overflow-hidden max-w-2xl w-full"><button onClick={() => setSelectedProof(null)} className="absolute top-4 right-4 bg-slate-900/50 hover:bg-slate-900 text-white p-2 rounded-full transition-colors"><X size={20}/></button><img src={selectedProof} alt="Proof" className="w-full h-auto max-h-[85vh] object-contain" /></div>
        </div>
      )}
    </div>
  )
}