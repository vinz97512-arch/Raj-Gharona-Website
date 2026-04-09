'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  Store, ShieldCheck, Mail, Lock, User, 
  Building2, Loader2, ArrowRight, CheckCircle2 
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function DualGateAuth() {
  const [portalType, setPortalType] = useState<'customer' | 'staff'>('customer')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    companyName: '',
    clientType: 'D2C' // Default for signups
  })

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (authMode === 'signup' && portalType === 'customer') {
        // 1. Sign Up Customer
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        })
        if (authError) throw authError

        if (authData.user) {
          // Create their profile in user_roles
          const { error: profileError } = await supabase.from('user_roles').insert([{
            id: authData.user.id,
            email: formData.email,
            full_name: formData.fullName,
            company_name: formData.companyName || null,
            role: 'customer',
            client_type: formData.clientType,
            account_status: formData.clientType === 'D2C' ? 'active' : 'pending',
            wallet_balance: 0,
            credit_limit: 0
          }])
          if (profileError) throw profileError
          
          toast.success(formData.clientType === 'D2C' ? 'Account created! Logging in...' : 'B2B Account created! Pending Admin KYC.')
          // Auto sign-in
          await loginUser()
        }
      } else {
        // 2. Sign In (Both Staff & Customer)
        await loginUser()
      }
    } catch (error: any) {
      toast.error(error.message)
      setIsSubmitting(false)
    }
  }

  const loginUser = async () => {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    })
    if (authError) throw authError

    // Route dynamically based on role
    if (authData.user) {
      const { data: roleData } = await supabase.from('user_roles').select('role').eq('id', authData.user.id).single()
      
      if (!roleData) throw new Error("Profile not found.")

      if (roleData.role === 'customer') {
        if (portalType === 'staff') {
          await supabase.auth.signOut()
          throw new Error("You do not have staff access. Please use the Customer Portal.")
        }
        window.location.replace('/store')
      } else {
        if (portalType === 'customer') {
           toast("Redirecting to Staff Workspace...", { icon: '🔄' })
        }
        // Staff goes to the MECE Gateway Portal
        window.location.replace('/portal')
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-3xl shadow-lg mb-6">R</div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Raj Gharona</h2>
        <p className="mt-2 text-sm text-slate-500 font-medium">Enterprise Unified Commerce Platform</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-3xl sm:px-10 border border-slate-100 relative overflow-hidden">
          
          {/* Dual Gate Toggle */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-8 relative z-10">
            <button 
              type="button"
              onClick={() => { setPortalType('customer'); setAuthMode('signin'); }} 
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${portalType === 'customer' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Store size={16}/> Customer
            </button>
            <button 
              type="button"
              onClick={() => { setPortalType('staff'); setAuthMode('signin'); }} 
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${portalType === 'staff' ? 'bg-slate-900 shadow-sm text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ShieldCheck size={16}/> Staff Portal
            </button>
          </div>

          <form className="space-y-5 relative z-10" onSubmit={handleAuth}>
            {authMode === 'signup' && portalType === 'customer' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <label className={`cursor-pointer text-center py-2 text-xs font-bold rounded-lg transition-colors ${formData.clientType === 'D2C' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <input type="radio" className="hidden" checked={formData.clientType === 'D2C'} onChange={() => setFormData({...formData, clientType: 'D2C'})}/> D2C Retail
                  </label>
                  <label className={`cursor-pointer text-center py-2 text-xs font-bold rounded-lg transition-colors ${formData.clientType !== 'D2C' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <input type="radio" className="hidden" checked={formData.clientType !== 'D2C'} onChange={() => setFormData({...formData, clientType: 'Distributor'})}/> B2B Partner
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name</label>
                  <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User size={16} className="text-slate-400" /></div><input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="block w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition-colors" placeholder="John Doe" /></div>
                </div>

                {formData.clientType !== 'D2C' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Company / Store Name</label>
                    <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Building2 size={16} className="text-slate-400" /></div><input required type="text" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="block w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition-colors" placeholder="XYZ Traders" /></div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Address</label>
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail size={16} className="text-slate-400" /></div><input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="block w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition-colors" placeholder="you@example.com" /></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Password</label>
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock size={16} className="text-slate-400" /></div><input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="block w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition-colors" placeholder="••••••••" /></div>
            </div>

            <button type="submit" disabled={isSubmitting} className={`w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white transition-all active:scale-95 ${portalType === 'staff' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (authMode === 'signup' ? <CheckCircle2 size={18}/> : <ArrowRight size={18}/>)}
              {authMode === 'signup' ? 'Create Account' : `Sign In to ${portalType === 'staff' ? 'Workspace' : 'Store'}`}
            </button>
          </form>

          {portalType === 'customer' ? (
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')} className="text-sm font-bold text-indigo-600 hover:text-indigo-500">
                {authMode === 'signin' ? "New customer? Create an account" : "Already have an account? Sign in"}
              </button>
            </div>
          ) : (
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400 font-medium">Staff accounts are managed strictly by Administration. You cannot sign up for a workspace account here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}