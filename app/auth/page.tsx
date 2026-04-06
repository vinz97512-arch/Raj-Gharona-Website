'use client'

import { useState, FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { Lock, Mail, ShieldCheck, Loader2, Building2, User } from 'lucide-react'
import Link from 'next/link'

export default function AuthHub() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'error' | 'success' | null; message: string }>({ type: null, message: '' })
  
  // New State for FMCG Logic
  const [accountTier, setAccountTier] = useState<'D2C' | 'B2B'>('D2C')
  const [formData, setFormData] = useState({ 
    email: '', password: '', companyName: '', clientType: 'Wholesale' 
  })

  const handleAuth = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setStatus({ type: null, message: '' })

    try {
      if (isLogin) {
        // --- LOGIN FLOW ---
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: formData.email, password: formData.password,
        })
        if (authError) throw authError

        const { data: roleData, error: roleError } = await supabase.from('user_roles').select('role, account_status').eq('id', authData.user.id).single()
        if (roleError && roleError.code !== 'PGRST116') throw roleError

        // Security Check: Lock out pending B2B accounts
        if (roleData?.account_status === 'pending') {
           await supabase.auth.signOut()
           throw new Error('Your B2B account is pending administrator approval.')
        }

        setStatus({ type: 'success', message: 'Authenticating...' })
        const userRole = roleData?.role || 'customer'
        router.push(userRole === 'admin' || userRole === 'sales' ? '/admin' : '/')

      } else {
        // --- SIGNUP FLOW ---
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: formData.email, password: formData.password,
        })
        if (error) throw error

        // If B2B, immediately update the database with their flour industry details
        if (signUpData.user && accountTier === 'B2B') {
           await supabase.from('user_roles').update({
             company_name: formData.companyName,
             client_type: formData.clientType,
             account_status: 'pending' // Locks them out until you approve
           }).eq('id', signUpData.user.id)
        }
        
        setStatus({ type: 'success', message: accountTier === 'B2B' ? 'Application submitted! Awaiting approval.' : 'Account created! Please log in.' })
        setIsLogin(true)
      }
    } catch (error) {
      if (error instanceof Error) setStatus({ type: 'error', message: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex bg-white">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-white mb-12">
            <ShieldCheck size={32} className="text-indigo-400" />
            <span className="text-2xl font-bold tracking-tight">Raj Gharona DB</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
            The secure gateway for <span className="text-indigo-400">FMCG Milling & Wholesale.</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-md">Serving D2C homes, commercial Roti factories, and pan-India distributors.</p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-slate-900 mb-8 transition-colors">&larr; Return to Storefront</Link>
          
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{isLogin ? 'Welcome back' : 'Create an account'}</h2>
            <p className="text-slate-500 mt-2">{isLogin ? 'Enter your credentials.' : 'Select your account type below.'}</p>
          </div>

          {!isLogin && (
            <div className="flex gap-4 mb-6">
              <button onClick={() => setAccountTier('D2C')} className={`flex-1 py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 font-semibold transition-all ${accountTier === 'D2C' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                <User size={18} /> Consumer (D2C)
              </button>
              <button onClick={() => setAccountTier('B2B')} className={`flex-1 py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 font-semibold transition-all ${accountTier === 'B2B' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                <Building2 size={18} /> Business (B2B)
              </button>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            
            {!isLogin && accountTier === 'B2B' && (
              <div className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Company / Factory Name</label>
                  <input required type="text" value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg outline-none" placeholder="e.g., Sharma Roti Udyog" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Business Tier</label>
                  <select value={formData.clientType} onChange={(e) => setFormData({...formData, clientType: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg outline-none">
                    <option>Wholesale</option>
                    <option>Distributor</option>
                    <option>Roti Factory</option>
                    <option>Retail (Modern)</option>
                    <option>Retail (Old School)</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 text-slate-400" size={18} />
                <input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none" placeholder="name@company.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 text-slate-400" size={18} />
                <input required type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none" placeholder="••••••••" />
              </div>
            </div>

            {status.type && (
              <div className={`p-3 rounded-lg text-sm font-medium border ${status.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                {status.message}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="w-full flex justify-center gap-2 bg-slate-900 text-white font-medium py-3 rounded-lg mt-4">
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setStatus({ type: null, message: '' }); setFormData({ email: '', password: '', companyName: '', clientType: 'Wholesale' }) }} className="text-sm text-slate-600 hover:text-slate-900 font-medium">
              {isLogin ? 'Don\'t have an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}