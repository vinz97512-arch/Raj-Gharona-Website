'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  LayoutDashboard, Banknote, Package, Truck, 
  Target, ShieldCheck, Loader2, LogOut, ArrowRight 
} from 'lucide-react'

interface UserRole {
  id: string; full_name: string; role: string;
  access_levels?: Record<string, 'none' | 'read' | 'write'>;
}

export default function StaffPortal() {
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<UserRole | null>(null)

  useEffect(() => {
    const initPortal = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return window.location.replace('/auth')
      
      const { data } = await supabase.from('user_roles').select('*').eq('id', session.user.id).single()
      
      if (data?.role === 'customer') {
        window.location.replace('/store') // Customers go to storefront
      } else {
        setProfile(data)
      }
      setIsLoading(false)
    }
    initPortal()
  }, [])

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 size={48} className="animate-spin text-indigo-600" /></div>

  const modules = [
    { id: 'admin', title: 'Command Center', desc: 'Global Config & Oversight', icon: ShieldCheck, color: 'bg-amber-50 text-amber-600', border: 'hover:border-amber-400', path: '/admin' },
    { id: 'finance', title: 'Finance Ops', desc: 'Ledgers, B2B & Margins', icon: Banknote, color: 'bg-emerald-50 text-emerald-600', border: 'hover:border-emerald-400', path: '/finance' },
    { id: 'inventory', title: 'Warehouse Ops', desc: 'Live Catalog & Stock', icon: LayoutDashboard, color: 'bg-indigo-50 text-indigo-600', border: 'hover:border-indigo-400', path: '/inventory' },
    { id: 'dispatch', title: 'Dispatch', desc: 'Milling & Fleet Routing', icon: Package, color: 'bg-blue-50 text-blue-600', border: 'hover:border-blue-400', path: '/dispatch' },
    { id: 'sales', title: 'Field Sales', desc: 'CRM & Order Punching', icon: Target, color: 'bg-rose-50 text-rose-600', border: 'hover:border-rose-400', path: '/sales' },
    { id: 'delivery', title: 'Delivery Fleet', desc: 'Manifests & COD', icon: Truck, color: 'bg-slate-100 text-slate-700', border: 'hover:border-slate-400', path: '/delivery' },
  ]

  // Filter modules based on granular access (must be 'read' or 'write', OR user is a legacy admin)
  const accessibleModules = modules.filter(m => {
    if (profile?.role === 'admin') return true; // Legacy fallback: Admin sees all
    const access = profile?.access_levels?.[m.id];
    return access === 'read' || access === 'write';
  })

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Raj Gharona Workspace</h1>
            <p className="text-slate-500 mt-1">Welcome back, {profile?.full_name}</p>
          </div>
          <button onClick={() => { supabase.auth.signOut(); window.location.replace('/auth'); }} className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:text-rose-600 transition-colors shadow-sm">
            <LogOut size={16}/> Logout
          </button>
        </header>

        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Authorized Modules</h2>
        
        {accessibleModules.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center shadow-sm">
            <ShieldCheck size={48} className="mx-auto text-slate-300 mb-4"/>
            <p className="font-bold text-lg text-slate-700">No Access Granted</p>
            <p className="text-slate-500">Contact your system administrator to assign module permissions to your account.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {accessibleModules.map(mod => {
              const accessLevel = profile?.access_levels?.[mod.id] || (profile?.role === 'admin' ? 'write' : 'read')
              return (
                <button key={mod.id} onClick={() => window.location.assign(mod.path)} className={`bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-left transition-all hover:shadow-md ${mod.border} group`}>
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${mod.color}`}><mod.icon size={28}/></div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${accessLevel === 'write' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{accessLevel} Access</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{mod.title}</h3>
                  <p className="text-sm text-slate-500 mb-6">{mod.desc}</p>
                  <div className="flex items-center text-sm font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">Enter Module <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform"/></div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}