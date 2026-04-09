'use client'

import { useEffect, useState, FormEvent, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  ShieldCheck, Activity, GitPullRequest, History, Users, 
  Settings, AlertOctagon, ArrowRight, CheckCircle2, 
  AlertTriangle, Eye, ShieldAlert, LogOut, Menu, X, 
  Loader2, Search, UserPlus, Key, Edit3, Save, 
  Sparkles, Gift, ChevronDown, ChevronUp, Banknote
} from 'lucide-react'
import toast from 'react-hot-toast'

// --- Interfaces ---
type AccessLevel = 'none' | 'read' | 'write'
interface ModuleAccess { _master: AccessLevel; [subTab: string]: AccessLevel; }
interface AccessMatrix { [module: string]: ModuleAccess; }
interface UserRole { id: string; full_name: string; email: string; role: string; account_status: string; employee_number?: string; client_type?: string; company_name?: string; wallet_balance?: number; access_levels?: AccessMatrix; temporary_access?: Record<string, string> | null; }
interface OrderItem { id: string; name: string; price: number; unit: string; quantity: number; }
interface Order { id: string; customer_name: string; total_amount: number; status: string; created_at: string; order_items: OrderItem[]; is_price_deviated?: boolean; }
interface WalletRequest { id: string; customer_name: string; amount: number; status: string; created_at: string; }
interface ActivityLog { id: string; agent_id: string; action_type: string; description: string; created_at: string; user_roles: { full_name: string; role: string; }; }

// --- Sub-Module Definitions for MECE Matrix ---
const systemModules = [
  { id: 'sales', label: 'Field Sales Ops', tabs: [{id: 'beat', label: 'Beat Route & Navigation'}, {id: 'punch_order', label: 'Punch Order & Pricing'}, {id: 'crm', label: 'Customer Directory & Ledgers'}, {id: 'pipeline', label: 'Outlet Onboarding (Leads)'}, {id: 'payments', label: 'Log Field Collections'}] },
  { id: 'finance', label: 'Finance & Accounts', tabs: [{id: 'b2b_orders', label: 'B2B Quotes & Approvals'}, {id: 'finance', label: 'Ledger Verification'}, {id: 'pricing', label: 'DPMIE Margin Engine'}, {id: 'approvals', label: 'KYC Activations'}] },
  { id: 'inventory', label: 'Warehouse & Catalog', tabs: [{id: 'inventory', label: 'Live Stock Visibility'}, {id: 'add', label: 'Add/Edit Catalog Items'}] },
  { id: 'dispatch', label: 'Dispatch & Routing', tabs: [{id: 'orders', label: 'Processing Pipeline'}, {id: 'fleet', label: 'Fleet Manifest Assignment'}] },
  { id: 'delivery', label: 'Delivery Fleet App', tabs: [{id: 'manifest', label: 'Active Route Manifest'}, {id: 'history', label: 'Completed Deliveries Log'}] }
]

const createDefaultMatrix = (): AccessMatrix => {
  const defaultAcc: AccessMatrix = {};
  systemModules.forEach(mod => {
    defaultAcc[mod.id] = { _master: 'none' };
    mod.tabs.forEach(tab => defaultAcc[mod.id][tab.id] = 'none');
  });
  return defaultAcc;
}

export default function SuperAdminCommandCenter() {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [adminProfile, setAdminProfile] = useState<UserRole | null>(null)
  
  const [activeView, setActiveView] = useState<'overview' | 'pipeline' | 'audit' | 'team' | 'settings'>('overview')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [orders, setOrders] = useState<Order[]>([])
  const [walletRequests, setWalletRequests] = useState<WalletRequest[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [allUsers, setAllUsers] = useState<UserRole[]>([])
  const [storeSettings, setStoreSettings] = useState({ reward_points_per_unit: 0.5, inr_per_reward_point: 1.0 })
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [roleAssignUserId, setRoleAssignUserId] = useState('')
  const [roleAssignRole, setRoleAssignRole] = useState('sales')
  
  // --- Permissions State ---
  const [matrixUser, setMatrixUser] = useState<UserRole | null>(null)
  const [matrixState, setMatrixState] = useState<AccessMatrix>(createDefaultMatrix())
  const [accessModalUser, setAccessModalUser] = useState<UserRole | null>(null)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)

  const fetchCommandData = useCallback(async () => {
    const { data: orderData } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (orderData) setOrders(orderData as Order[])
    
    const { data: walletData } = await supabase.from('wallet_requests').select('*').eq('status', 'Pending')
    if (walletData) setWalletRequests(walletData as WalletRequest[])
    
    const { data: usersData } = await supabase.from('user_roles').select('*')
    if (usersData) setAllUsers(usersData as UserRole[])
    
    const { data: logData } = await supabase.from('agent_activities').select('id, agent_id, action_type, description, created_at, user_roles!inner(full_name, role)').order('created_at', { ascending: false }).limit(100)
    if (logData) setActivities(logData as unknown as ActivityLog[])

    const { data: settingsData } = await supabase.from('store_settings').select('*').eq('id', 1).single()
    if (settingsData) setStoreSettings({ reward_points_per_unit: settingsData.reward_points_per_unit, inr_per_reward_point: settingsData.inr_per_reward_point })
  }, [])

  useEffect(() => {
    let isMounted = true
    const initAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return window.location.replace('/auth')
      const { data: roleData } = await supabase.from('user_roles').select('*').eq('id', session.user.id).single()
      
      if (roleData?.role === 'admin') {
        if (isMounted) { setIsAuthorized(true); setAdminProfile(roleData as UserRole); fetchCommandData() }
      } else { window.location.replace('/portal') }
      
      if (isMounted) setIsLoadingAuth(false)
    }
    initAdmin()
    return () => { isMounted = false }
  }, [fetchCommandData])

  const handleForceAdvance = async (id: string, currentStatus: string) => {
    if(!window.confirm("WARNING: You are overriding standard operational workflows. Proceed?")) return;
    setIsSubmitting(true)
    const pipeline = ['New Order', 'Pending Approval', 'Awaiting Payment', 'Processing (Milling)', 'Dispatched', 'Delivered']
    const currentIndex = pipeline.indexOf(currentStatus)
    if (currentIndex < pipeline.length - 1) {
      const nextStatus = pipeline[currentIndex + 1]
      const { error } = await supabase.from('orders').update({ status: nextStatus }).eq('id', id)
      if (adminProfile) await supabase.from('agent_activities').insert([{ agent_id: adminProfile.id, action_type: 'Executive Override', description: `Admin forced order #${id.split('-')[0]} from ${currentStatus} to ${nextStatus}` }])
      if (!error) { toast.success(`Forced to: ${nextStatus}`); setSelectedOrder(null); fetchCommandData() } else { toast.error(error.message) }
    }
    setIsSubmitting(false)
  }

  const handleAssignRole = async (e: FormEvent) => {
    e.preventDefault(); if (!roleAssignUserId) return toast.error("Select a user."); setIsSubmitting(true);
    const { error } = await supabase.from('user_roles').update({ role: roleAssignRole }).eq('id', roleAssignUserId);
    if (!error) { toast.success("Staff Role Assigned successfully!"); fetchCommandData(); setRoleAssignUserId(''); } else { toast.error(error.message); }
    setIsSubmitting(false);
  }

  const openPermissionMatrix = (user: UserRole) => {
    setMatrixUser(user);
    const currentAccess = user.access_levels || {};
    const newAccess = createDefaultMatrix();
    Object.keys(newAccess).forEach(mod => {
      const legacyVal = (currentAccess as Record<string, unknown>)[mod];
      if (legacyVal) {
        if (typeof legacyVal === 'string') {
          newAccess[mod]._master = legacyVal as AccessLevel;
          systemModules.find(m => m.id === mod)?.tabs.forEach(t => newAccess[mod][t.id] = legacyVal as AccessLevel);
        } else {
          newAccess[mod] = { ...newAccess[mod], ...(legacyVal as unknown as ModuleAccess) };
        }
      }
    });
    setMatrixState(newAccess);
  }

  const updateMatrixValue = (modId: string, tabId: string, value: AccessLevel) => {
    setMatrixState(prev => {
      const newState = { ...prev };
      if (!newState[modId]) newState[modId] = { _master: 'none' };
      
      if (tabId === '_master') {
        newState[modId]._master = value;
        systemModules.find(m => m.id === modId)?.tabs.forEach(t => newState[modId][t.id] = value);
      } else {
        newState[modId][tabId] = value;
        if (value !== 'none' && newState[modId]._master === 'none') {
          newState[modId]._master = 'read';
        }
      }
      return newState;
    });
  }

  const handleSavePermissions = async () => {
    if (!matrixUser) return;
    setIsSubmitting(true);
    const { error } = await supabase.from('user_roles').update({ access_levels: matrixState, role: matrixUser.role === 'customer' ? 'sales' : matrixUser.role }).eq('id', matrixUser.id);
    if (!error) { toast.success(`Permissions saved for ${matrixUser.full_name || matrixUser.email}`); setMatrixUser(null); fetchCommandData(); } else { toast.error(error.message); }
    setIsSubmitting(false);
  }

  const handleGrantGuestPass = async (moduleName: string) => {
    if (!accessModalUser) return;
    setIsSubmitting(true);
    const currentTime = new Date().getTime();
    const expiresAt = new Date(currentTime + 24 * 60 * 60 * 1000).toISOString();
    const currentAccess = accessModalUser.temporary_access || {};
    const newAccess = { ...currentAccess, [moduleName]: expiresAt };
    const { error } = await supabase.from('user_roles').update({ temporary_access: newAccess }).eq('id', accessModalUser.id);
    if (!error) { toast.success(`24H Access to ${moduleName.toUpperCase()} granted!`); setAccessModalUser(null); fetchCommandData(); } else { toast.error(error.message); }
    setIsSubmitting(false);
  }

  const handleRevokePass = async (userId: string, moduleName: string, currentAccess: Record<string, string>) => {
    setIsSubmitting(true);
    const newAccess = { ...currentAccess };
    delete newAccess[moduleName];
    const { error } = await supabase.from('user_roles').update({ temporary_access: newAccess }).eq('id', userId);
    if (!error) { toast.success("Pass Revoked."); fetchCommandData(); } else { toast.error(error.message); }
    setIsSubmitting(false);
  }

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    const { error } = await supabase.from('store_settings').update({ reward_points_per_unit: storeSettings.reward_points_per_unit, inr_per_reward_point: storeSettings.inr_per_reward_point }).eq('id', 1);
    if (!error) toast.success('Global Settings Saved!'); else toast.error(error.message);
    setIsSubmitting(false);
  }

  const bottlenecks = { finance: orders.filter(o => o.status === 'Pending Approval').length + walletRequests.length, dispatch: orders.filter(o => o.status === 'Processing (Milling)').length, delivery: orders.filter(o => o.status === 'Dispatched').length }
  const getStageOwner = (status: string) => { switch(status) { case 'Pending Approval': case 'Awaiting Payment': return { team: 'Finance', color: 'bg-amber-100 text-amber-800' }; case 'Processing (Milling)': return { team: 'Dispatch', color: 'bg-blue-100 text-blue-800' }; case 'Dispatched': return { team: 'Delivery', color: 'bg-indigo-100 text-indigo-800' }; case 'Delivered': return { team: 'Completed', color: 'bg-emerald-100 text-emerald-800' }; default: return { team: 'Sales', color: 'bg-slate-100 text-slate-800' } } }

  const navItems = [{ id: 'overview', icon: Activity, label: 'Command Overview' }, { id: 'pipeline', icon: GitPullRequest, label: 'Global Order Pipeline' }, { id: 'audit', icon: History, label: 'System Audit Logs' }, { id: 'team', icon: Users, label: 'Team & Governance' }, { id: 'settings', icon: Settings, label: 'Global Settings' }]

  if (isLoadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 size={48} className="animate-spin text-indigo-600" /></div>
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center text-center p-12 font-bold text-slate-900"><ShieldAlert size={64} className="mx-auto text-red-500 mb-4" />Super Admin Required.</div>

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row w-full overflow-x-hidden text-slate-900 font-sans">
      <div className="md:hidden bg-slate-900 text-white h-16 flex items-center justify-between px-4 sticky top-0 z-30 shrink-0 shadow-md"><div className="font-bold text-lg flex items-center gap-2"><ShieldCheck size={20}/> Command Center</div><button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-300"><Menu size={24} /></button></div>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0"><span className="text-white font-bold text-lg flex items-center gap-2"><ShieldCheck size={20} className="text-amber-400"/> SUPER ADMIN</span><button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white"><X size={20}/></button></div>
        <div className="p-6 border-b border-slate-800 bg-slate-800/30"><p className="text-white font-bold truncate">{adminProfile?.full_name || 'System Admin'}</p><p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">God Mode Active</p></div>
        <nav className="flex-1 px-4 py-6 space-y-2">{navItems.map(item => (<button key={item.id} onClick={() => { setActiveView(item.id as any); setIsMobileMenuOpen(false) }} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-sm ${activeView === item.id ? 'bg-amber-500 text-white shadow-md' : 'hover:bg-slate-800'}`}><div className="flex items-center gap-3"><item.icon size={20} className={activeView === item.id ? 'text-white' : 'text-slate-400'} /> {item.label}</div></button>))}</nav>
        <div className="p-4 border-t border-slate-800"><button onClick={() => { supabase.auth.signOut(); window.location.replace('/auth'); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl font-bold transition-colors"><LogOut size={20} /> Logout</button></div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-screen">
        <header className="mb-6 md:mb-8 flex justify-between items-center"><h2 className="text-2xl font-bold text-slate-900 tracking-tight">{navItems.find(n => n.id === activeView)?.label}</h2></header>

        {activeView === 'overview' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4"><div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Activity size={28}/></div><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Active Orders</p><p className="text-3xl font-black text-slate-900">{orders.filter(o => o.status !== 'Delivered').length}</p></div></div><div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4"><div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center"><AlertOctagon size={28}/></div><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Price Deviations</p><p className="text-3xl font-black text-slate-900">{orders.filter(o => o.is_price_deviated && o.status === 'Pending Approval').length}</p></div></div><div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4"><div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><CheckCircle2 size={28}/></div><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Today&apos;s Revenue</p><p className="text-3xl font-black text-slate-900">₹{orders.filter(o => o.status === 'Delivered').reduce((acc, o) => acc + o.total_amount, 0).toLocaleString()}</p></div></div></div>
            <h3 className="text-lg font-bold text-slate-900 mt-8 mb-4">Department Load & Bottlenecks</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`p-6 rounded-3xl border ${bottlenecks.finance > 5 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'} shadow-sm`}><div className="flex justify-between items-start mb-4"><h4 className="font-bold text-slate-900">Finance Team</h4>{bottlenecks.finance > 5 && <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded uppercase flex items-center gap-1"><AlertTriangle size={12}/> Bottleneck</span>}</div><div className="space-y-2"><div className="flex justify-between text-sm font-medium"><span>Pending Approvals:</span> <span className="font-bold text-slate-900">{orders.filter(o => o.status === 'Pending Approval').length}</span></div><div className="flex justify-between text-sm font-medium"><span>Pending Payments:</span> <span className="font-bold text-slate-900">{walletRequests.length}</span></div></div></div>
              <div className={`p-6 rounded-3xl border ${bottlenecks.dispatch > 10 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'} shadow-sm`}><div className="flex justify-between items-start mb-4"><h4 className="font-bold text-slate-900">Dispatch Team</h4>{bottlenecks.dispatch > 10 && <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded uppercase flex items-center gap-1"><AlertTriangle size={12}/> Bottleneck</span>}</div><div className="space-y-2"><div className="flex justify-between text-sm font-medium"><span>Awaiting Processing:</span> <span className="font-bold text-slate-900">{bottlenecks.dispatch}</span></div></div></div>
              <div className={`p-6 rounded-3xl border ${bottlenecks.delivery > 15 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'} shadow-sm`}><div className="flex justify-between items-start mb-4"><h4 className="font-bold text-slate-900">Delivery Fleet</h4>{bottlenecks.delivery > 15 && <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded uppercase flex items-center gap-1"><AlertTriangle size={12}/> Bottleneck</span>}</div><div className="space-y-2"><div className="flex justify-between text-sm font-medium"><span>Currently on Road:</span> <span className="font-bold text-slate-900">{bottlenecks.delivery}</span></div></div></div>
            </div>
          </div>
        )}

        {activeView === 'pipeline' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 w-full overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><div><h3 className="font-bold text-slate-900">All Master Orders</h3><p className="text-xs text-slate-500 mt-1">Cross-departmental pipeline tracker.</p></div><div className="relative w-64"><Search className="absolute left-3 top-2.5 text-slate-400" size={16}/><input type="text" placeholder="Search orders..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm outline-none focus:border-amber-500" /></div></div>
            <div className="overflow-x-auto w-full"><table className="w-full text-left whitespace-nowrap"><thead className="bg-white border-b border-slate-100 text-xs text-slate-500 font-bold uppercase tracking-wider"><tr><th className="p-5">Order ID</th><th className="p-5">Customer</th><th className="p-5">Current Dependency</th><th className="p-5 text-right">Value</th><th className="p-5 text-center">Admin Override</th></tr></thead><tbody className="divide-y divide-slate-50 text-sm">
                  {orders.map(o => { const owner = getStageOwner(o.status); return (<tr key={o.id} className="hover:bg-slate-50 transition-colors"><td className="p-5 font-mono font-bold text-slate-500 text-xs">#{o.id.split('-')[0].toUpperCase()}</td><td className="p-5"><p className="font-bold text-slate-900">{o.customer_name}</p><p className="text-[10px] text-slate-400 mt-0.5">{new Date(o.created_at).toLocaleString()}</p></td><td className="p-5"><div className="flex flex-col items-start gap-1"><span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${owner.color}`}>Pending: {owner.team}</span><span className="text-xs font-bold text-slate-600">{o.status}</span></div></td><td className="p-5 text-right font-bold text-slate-900">₹{o.total_amount.toLocaleString()}</td><td className="p-5 text-center"><button onClick={() => setSelectedOrder(o)} className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-xs transition-colors"><Eye size={14}/> Inspect & Override</button></td></tr>)})}
            </tbody></table></div>
          </div>
        )}

        {activeView === 'audit' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 w-full overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-900">Immutable Audit Trail</h3><p className="text-xs text-slate-500 mt-1">Tracks every critical action taken by internal staff across the platform.</p></div>
            <div className="divide-y divide-slate-50 p-2">{activities.length === 0 ? <p className="p-8 text-center text-slate-500">No system logs found.</p> : activities.map(act => (<div key={act.id} className="p-4 flex gap-4 hover:bg-slate-50 rounded-xl transition-colors"><div className="mt-1"><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><History size={14}/></div></div><div className="flex-1"><div className="flex items-center gap-2 mb-1"><p className="text-xs font-bold text-slate-900">{act.user_roles?.full_name || 'System'}</p><span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">{act.user_roles?.role || 'Auto'}</span><span className="text-[10px] text-slate-400 ml-auto">{new Date(act.created_at).toLocaleString()}</span></div><p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">{act.action_type}</p><p className="text-sm font-medium text-slate-700">{act.description}</p></div></div>))}</div>
          </div>
        )}

        {activeView === 'team' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-8 rounded-3xl border shadow-sm max-w-4xl">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><UserPlus className="text-indigo-600" /> Promote User to Staff</h3>
                <p className="text-sm text-slate-500 mt-1">Assign primary roles to users. Note: Changing a role wipes their previous custom access matrix to prevent security leaks.</p>
              </div>
              <form onSubmit={handleAssignRole} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold mb-2 text-slate-700 uppercase">Select Any User</label>
                  <select required value={roleAssignUserId} onChange={e => setRoleAssignUserId(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="" disabled>-- Search User --</option>
                    {allUsers.filter(u => u.role !== 'admin').map(u => <option key={u.id} value={u.id}>{u.email} ({u.role.toUpperCase()})</option>)}
                  </select>
                </div>
                <div className="w-full md:w-64">
                  <label className="block text-xs font-bold mb-2 text-slate-700 uppercase">Select Primary Role</label>
                  <select value={roleAssignRole} onChange={e => setRoleAssignRole(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="customer">Customer (Demote)</option>
                    <option value="sales">Sales Agent</option>
                    <option value="finance">Finance Manager</option>
                    <option value="inventory">Inventory Manager</option>
                    <option value="dispatch">Dispatch Manager</option>
                    <option value="delivery">Delivery Driver</option>
                  </select>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl shadow-md transition-colors">{isSubmitting ? <Loader2 size={18} className="animate-spin mx-auto"/> : 'Apply Role'}</button>
              </form>
            </div>

            <div className="bg-white rounded-3xl border shadow-sm max-w-5xl overflow-hidden">
              <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900">Active Internal Roster & Access Control</h3>
                <p className="text-sm text-slate-500 mt-1">Configure deep tab-level permissions or grant 24H temporary guest passes.</p>
              </div>
              <div className="divide-y divide-slate-100 p-2">
                {allUsers.filter(c => c.role !== 'customer').map(staff => (
                  <div key={staff.id} className="flex flex-col lg:flex-row lg:items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors gap-4">
                    <div className="w-full lg:w-1/3">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 text-lg">{staff.full_name || 'Unnamed Staff'}</p>
                        {staff.role === 'admin' && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-amber-200">Admin</span>}
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{staff.email}</p>
                      
                      {staff.temporary_access && Object.keys(staff.temporary_access).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Object.entries(staff.temporary_access).map(([mod, expires]) => {
                            if (new Date(expires) < new Date()) return null;
                            return (
                              <div key={mod} className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                                <Key size={10}/> Guest: {mod} 
                                <button onClick={() => handleRevokePass(staff.id, mod, staff.temporary_access || {})} className="ml-1 text-amber-500 hover:text-amber-900"><X size={12}/></button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 flex flex-wrap gap-2">
                      {systemModules.map(mod => {
                        if (staff.role === 'admin') return <span key={mod.id} className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">{mod.id}: Write</span>
                        const access = staff.access_levels?.[mod.id]?._master || 'none';
                        if (access === 'none') return null;
                        return (
                          <span key={mod.id} className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${access === 'write' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                            {mod.id}: {access}
                          </span>
                        )
                      })}
                      {staff.role !== 'admin' && (!staff.access_levels || Object.values(staff.access_levels).every(v => v._master === 'none')) && <span className="text-sm italic text-slate-400">No active module access.</span>}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {staff.role !== 'admin' && (
                        <>
                          <button onClick={() => openPermissionMatrix(staff)} className="bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-sm"><Edit3 size={16}/> Edit Matrix</button>
                          <button onClick={() => setAccessModalUser(staff)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"><Key size={14}/> Guest Pass</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. MODERNIZED GLOBAL SETTINGS */}
        {activeView === 'settings' && (
          <div className="space-y-6 animate-in fade-in max-w-4xl">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-2 text-slate-900"><Sparkles className="text-indigo-600" /> Reward System Engine</h3>
                <p className="text-slate-500 mb-8">Configure how customers earn and redeem R-Cash (Loyalty Points) across the D2C and B2B storefronts.</p>
                
                <form onSubmit={handleSaveSettings} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 flex items-center justify-center rounded-xl"><Gift size={20}/></div>
                        <h4 className="font-bold text-slate-800 text-lg">Earning Rule</h4>
                      </div>
                      <label className="block text-xs font-bold mb-2 uppercase text-slate-500">R-Cash Earned per 1 Unit (kg/liter)</label>
                      <div className="relative">
                        <input type="number" step="0.1" required className="w-full p-4 pl-6 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-shadow text-lg" value={storeSettings.reward_points_per_unit} onChange={e => setStoreSettings({...storeSettings, reward_points_per_unit: Number(e.target.value)})} />
                        <span className="absolute right-4 top-4 text-slate-400 font-bold">Pts</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded-xl"><Banknote size={20}/></div>
                        <h4 className="font-bold text-slate-800 text-lg">Redemption Value</h4>
                      </div>
                      <label className="block text-xs font-bold mb-2 uppercase text-slate-500">INR Value per 1 R-Cash Point</label>
                      <div className="relative">
                        <span className="absolute left-4 top-4 text-slate-400 font-bold text-lg">₹</span>
                        <input type="number" step="0.1" required className="w-full p-4 pl-10 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm transition-shadow text-lg" value={storeSettings.inr_per_reward_point} onChange={e => setStoreSettings({...storeSettings, inr_per_reward_point: Number(e.target.value)})} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Live Engine Preview</p>
                      <p className="text-indigo-900 font-medium">If a customer buys <strong className="font-bold">100 kg</strong> of product, they earn <strong className="font-bold">{100 * storeSettings.reward_points_per_unit} R-Cash</strong>, worth <strong className="font-bold text-emerald-600">₹{(100 * storeSettings.reward_points_per_unit * storeSettings.inr_per_reward_point).toFixed(2)}</strong> off their next order.</p>
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-indigo-600 text-white font-bold py-4 px-8 rounded-xl shadow-md flex items-center justify-center gap-2 hover:bg-indigo-700 transition-transform active:scale-95 shrink-0">
                      {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} Save Config
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- GRANULAR PERMISSION MATRIX MODAL --- */}
      {matrixUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => {setMatrixUser(null); setExpandedModule(null);}}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="text-indigo-600"/> Edit Access Matrix</h3>
                <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">Configuring permissions for <strong className="text-indigo-600">{matrixUser.full_name || matrixUser.email}</strong> <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono font-bold tracking-wider">{matrixUser.email}</span></p>
              </div>
              <button onClick={() => {setMatrixUser(null); setExpandedModule(null);}} className="p-2 bg-white text-slate-400 hover:text-slate-900 rounded-full shadow-sm"><X size={20}/></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
              <div className="space-y-4">
                {systemModules.map(mod => {
                  const isExpanded = expandedModule === mod.id;
                  const masterAccess = matrixState[mod.id]?._master || 'none';
                  
                  return (
                    <div key={mod.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="p-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                        <button onClick={() => setExpandedModule(isExpanded ? null : mod.id)} className="flex items-center gap-3 flex-1 text-left">
                          <div className={`p-2 rounded-lg ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{mod.label}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{mod.tabs.length} Sub-Modules</p>
                          </div>
                        </button>
                        
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 ml-4">
                          <label className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${masterAccess === 'none' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
                            <input type="radio" className="hidden" checked={masterAccess === 'none'} onChange={() => updateMatrixValue(mod.id, '_master', 'none')} /> None
                          </label>
                          <label className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${masterAccess === 'read' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-indigo-700'}`}>
                            <input type="radio" className="hidden" checked={masterAccess === 'read'} onChange={() => updateMatrixValue(mod.id, '_master', 'read')} /> Read
                          </label>
                          <label className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${masterAccess === 'write' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-emerald-700'}`}>
                            <input type="radio" className="hidden" checked={masterAccess === 'write'} onChange={() => updateMatrixValue(mod.id, '_master', 'write')} /> Read+Write
                          </label>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-slate-50 border-t border-slate-100 p-4 space-y-2">
                          <div className="flex justify-between items-center px-4 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Specific Tab Access</span>
                            <span>Permission Level</span>
                          </div>
                          {mod.tabs.map(tab => {
                            const tabAccess = matrixState[mod.id]?.[tab.id] || 'none';
                            return (
                              <div key={tab.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                                <span className="text-sm font-medium text-slate-700">{tab.label}</span>
                                <div className="flex items-center gap-1">
                                  <label className={`cursor-pointer px-2 py-1 rounded text-[10px] font-bold transition-colors ${tabAccess === 'none' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-100'}`}><input type="radio" className="hidden" checked={tabAccess === 'none'} onChange={() => updateMatrixValue(mod.id, tab.id, 'none')} /> None</label>
                                  <label className={`cursor-pointer px-2 py-1 rounded text-[10px] font-bold transition-colors ${tabAccess === 'read' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-indigo-50'}`}><input type="radio" className="hidden" checked={tabAccess === 'read'} onChange={() => updateMatrixValue(mod.id, tab.id, 'read')} /> Read</label>
                                  <label className={`cursor-pointer px-2 py-1 rounded text-[10px] font-bold transition-colors ${tabAccess === 'write' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:bg-emerald-50'}`}><input type="radio" className="hidden" checked={tabAccess === 'write'} onChange={() => updateMatrixValue(mod.id, tab.id, 'write')} /> Write</label>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
              <button onClick={() => {setMatrixUser(null); setExpandedModule(null);}} className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
              <button onClick={handleSavePermissions} disabled={isSubmitting} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-md transition-transform active:scale-95">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Matrix Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TEMPORARY ACCESS MODAL --- */}
      {accessModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setAccessModalUser(null)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Grant 24H Guest Pass</h3>
            <p className="text-sm text-slate-500 mb-6">Allow <strong className="text-indigo-600">{accessModalUser.full_name || accessModalUser.email}</strong> to temporarily access another department&apos;s dashboard.</p>
            <div className="space-y-3">
              {['inventory', 'finance', 'dispatch', 'sales', 'delivery'].map(mod => (
                <button key={mod} onClick={() => handleGrantGuestPass(mod)} disabled={isSubmitting} className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl font-bold text-slate-700 hover:text-indigo-700 transition-colors uppercase tracking-wider text-sm flex items-center justify-between">
                  {mod} <ArrowRight size={16}/>
                </button>
              ))}
            </div>
            <button onClick={() => setAccessModalUser(null)} className="w-full mt-4 py-3 text-sm font-bold text-slate-400 hover:text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      {/* --- SUPER ADMIN OVERRIDE MODAL --- */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50">
              <div><h3 className="text-xl font-bold text-amber-900 flex items-center gap-2"><ShieldAlert size={20}/> Executive Override</h3><p className="text-xs font-bold text-amber-700 uppercase tracking-wider mt-1">Order #{selectedOrder.id.split('-')[0]}</p></div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 bg-white text-slate-400 hover:text-slate-900 rounded-full shadow-sm"><X size={20}/></button>
            </div>
            <div className="p-8 overflow-y-auto flex-1 space-y-8 bg-white">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Order Lifecycle Trace</p>
                <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pb-2">
                  {['New Order', 'Pending Approval', 'Awaiting Payment', 'Processing (Milling)', 'Dispatched', 'Delivered'].map((step, idx) => {
                    const currentIdx = ['New Order', 'Pending Approval', 'Awaiting Payment', 'Processing (Milling)', 'Dispatched', 'Delivered'].indexOf(selectedOrder.status)
                    const isCompleted = idx <= currentIdx
                    const isCurrent = idx === currentIdx
                    return (
                      <div key={step} className="relative pl-6"><div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${isCompleted ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'} ${isCurrent ? 'ring-4 ring-emerald-100' : ''}`}></div><p className={`text-sm font-bold ${isCurrent ? 'text-slate-900' : isCompleted ? 'text-slate-600' : 'text-slate-400'}`}>{step}</p></div>
                    )
                  })}
                </div>
              </div>
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6">
                <h4 className="font-bold text-rose-900 mb-2 flex items-center gap-2"><AlertOctagon size={16}/> Force Pipeline Advancement</h4>
                <p className="text-xs text-rose-700 mb-4">Warning: Forcing this order to the next stage will bypass standard departmental checks. This action is permanently logged.</p>
                <button onClick={() => handleForceAdvance(selectedOrder.id, selectedOrder.status)} disabled={isSubmitting || selectedOrder.status === 'Delivered'} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95 disabled:opacity-50">{isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <ArrowRight size={18}/>} Bypass Guardrails & Force Advance</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}