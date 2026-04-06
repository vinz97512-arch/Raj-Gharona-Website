'use client'

import { useEffect, useState, FormEvent, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  KanbanSquare, MapPin, UserPlus, LogOut, ShieldAlert, 
  Loader2, Phone, Building2, ArrowRight, CheckCircle2, 
  XCircle, Search, Menu, X, Briefcase
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Lead {
  id: string; company_name: string; contact_person: string; phone_number: string;
  pincode: string; status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
  assigned_to: string; notes: string; created_at: string;
}

interface SalesAgent {
  id: string; full_name: string; role: string; assigned_pincodes: string[];
}

export default function SalesDashboard() {
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [agent, setAgent] = useState<SalesAgent | null>(null)
  
  const [activeView, setActiveView] = useState<'pipeline' | 'add_lead' | 'territory'>('pipeline')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  const [leads, setLeads] = useState<Lead[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [formData, setFormData] = useState({ company_name: '', contact_person: '', phone_number: '', pincode: '', notes: '' })

  const fetchLeads = useCallback(async (userId: string, role: string) => {
    const query = supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (role !== 'admin') query.eq('assigned_to', userId)
    
    const { data } = await query
    if (data) setLeads(data as Lead[])
  }, [])

  useEffect(() => {
    let isMounted = true
    const initSales = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return window.location.replace('/auth')
      
      const { data: roleData } = await supabase.from('user_roles').select('*').eq('id', session.user.id).single()
      
      if (roleData?.role === 'admin' || roleData?.role === 'sales') {
        if (isMounted) {
          setIsAuthorized(true)
          setAgent(roleData as SalesAgent)
          fetchLeads(session.user.id, roleData.role)
        }
      } else {
        window.location.replace('/')
      }
      if (isMounted) setIsLoadingAuth(false)
    }
    initSales()
    return () => { isMounted = false }
  }, [fetchLeads])

  const handleAddLead = async (e: FormEvent) => {
    e.preventDefault()
    if (!agent) return
    setIsSaving(true)

    const newLead = { ...formData, assigned_to: agent.id, status: 'New' }
    const { error } = await supabase.from('leads').insert([newLead])

    if (!error) {
      toast.success('New B2B Lead Added!')
      setFormData({ company_name: '', contact_person: '', phone_number: '', pincode: '', notes: '' })
      fetchLeads(agent.id, agent.role)
      setActiveView('pipeline')
    } else {
      toast.error('Error: ' + error.message)
    }
    setIsSaving(false)
  }

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId)
    if (!error) {
      toast.success(`Lead moved to ${newStatus}`)
      if (agent) fetchLeads(agent.id, agent.role)
    } else {
      toast.error('Update failed')
    }
  }

  const filteredLeads = leads.filter(l => 
    l.company_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.pincode.includes(searchQuery) ||
    (l.contact_person && l.contact_person.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const columns: ('New' | 'Contacted' | 'Qualified')[] = ['New', 'Contacted', 'Qualified']

  if (isLoadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 size={48} className="animate-spin text-indigo-600" /></div>
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center text-center p-12 font-bold text-slate-900"><ShieldAlert size={64} className="mx-auto text-red-500 mb-4" />Access Denied</div>

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row w-full overflow-x-hidden font-sans text-slate-900">
      <div className="md:hidden bg-slate-900 text-white h-16 flex items-center justify-between px-4 sticky top-0 z-30 shrink-0 shadow-md">
        <div className="font-bold text-lg flex items-center gap-2"><Briefcase size={20}/> Sales Portal</div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-300"><Menu size={24} /></button>
      </div>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
          <span className="text-white font-bold text-lg flex items-center gap-2"><Briefcase size={20}/> RG Sales</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white"><X size={20}/></button>
        </div>
        <div className="p-6 border-b border-slate-800">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Agent Profile</p>
          <p className="text-white font-bold truncate">{agent?.full_name || 'Field Agent'}</p>
          <span className="inline-block mt-2 px-2 py-1 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded uppercase">{agent?.role}</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          <button onClick={() => { setActiveView('pipeline'); setIsMobileMenuOpen(false) }} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${activeView === 'pipeline' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><div className="flex items-center gap-3"><KanbanSquare size={20} /> Pipeline</div><span className="bg-slate-800/50 px-2 py-0.5 rounded text-xs">{leads.filter(l => !['Converted', 'Lost'].includes(l.status)).length}</span></button>
          <button onClick={() => { setActiveView('add_lead'); setIsMobileMenuOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === 'add_lead' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><UserPlus size={20} /> Punch New Lead</button>
          <button onClick={() => { setActiveView('territory'); setIsMobileMenuOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === 'territory' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><MapPin size={20} /> My Territory</button>
        </nav>
        <div className="p-4 border-t border-slate-800"><button onClick={() => { supabase.auth.signOut(); window.location.replace('/auth'); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 hover:text-red-400 rounded-xl font-bold transition-colors"><LogOut size={20} /> Logout</button></div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto flex flex-col h-screen">
        <header className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 bg-white p-5 rounded-2xl border shadow-sm gap-4 shrink-0">
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">{activeView.replace('_', ' ')}</h2>
          {activeView === 'pipeline' && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input type="text" placeholder="Search leads..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-full text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 shadow-sm" />
            </div>
          )}
        </header>

        {activeView === 'pipeline' && (
          <div className="flex-1 flex gap-6 overflow-x-auto pb-4 hide-scrollbar">
            {columns.map(col => (
              <div key={col} className="w-80 shrink-0 flex flex-col bg-slate-100 rounded-2xl p-4 border border-slate-200">
                <div className="flex justify-between items-center mb-4 px-2">
                  <h3 className="font-bold text-slate-700 uppercase tracking-wider text-xs">{col}</h3>
                  <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{filteredLeads.filter(l => l.status === col).length}</span>
                </div>
                <div className="space-y-3 overflow-y-auto flex-1">
                  {filteredLeads.filter(l => l.status === col).map(lead => (
                    <div key={lead.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in fade-in group hover:border-indigo-300 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-slate-900 leading-tight">{lead.company_name}</div>
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{lead.pincode}</span>
                      </div>
                      <div className="text-sm text-slate-600 flex items-center gap-2 mb-1 font-medium"><Building2 size={14} className="text-slate-400"/> {lead.contact_person || 'No Contact'}</div>
                      <div className="text-sm text-slate-600 flex items-center gap-2 mb-3 font-medium"><Phone size={14} className="text-slate-400"/> <a href={`tel:${lead.phone_number}`} className="hover:text-indigo-600">{lead.phone_number}</a></div>
                      
                      <div className="pt-3 border-t border-slate-100 flex justify-between gap-2">
                        {col === 'New' && <button onClick={() => updateLeadStatus(lead.id, 'Contacted')} className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-1.5 rounded-lg text-xs font-bold transition-colors">Contacted <ArrowRight size={12} className="inline"/></button>}
                        {col === 'Contacted' && <button onClick={() => updateLeadStatus(lead.id, 'Qualified')} className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 py-1.5 rounded-lg text-xs font-bold transition-colors">Qualified <ArrowRight size={12} className="inline"/></button>}
                        {col === 'Qualified' && <button onClick={() => updateLeadStatus(lead.id, 'Converted')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"><CheckCircle2 size={12} className="inline mr-1"/> Win</button>}
                        
                        <button onClick={() => updateLeadStatus(lead.id, 'Lost')} className="px-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition-colors"><XCircle size={16}/></button>
                      </div>
                    </div>
                  ))}
                  {filteredLeads.filter(l => l.status === col).length === 0 && <div className="text-center py-8 text-slate-400 text-xs font-medium border-2 border-dashed border-slate-200 rounded-xl">Drop leads here</div>}
                </div>
              </div>
            ))}
            
            <div className="w-80 shrink-0 flex flex-col bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100">
                <div className="flex justify-between items-center mb-4 px-2">
                  <h3 className="font-bold text-emerald-800 uppercase tracking-wider text-xs">Recent Wins</h3>
                  <span className="bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-bold">{filteredLeads.filter(l => l.status === 'Converted').length}</span>
                </div>
                <div className="space-y-3 overflow-y-auto flex-1">
                  {filteredLeads.filter(l => l.status === 'Converted').map(lead => (
                    <div key={lead.id} className="bg-white p-3 rounded-xl border border-emerald-200 shadow-sm opacity-80"><div className="font-bold text-emerald-900 text-sm flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500"/> {lead.company_name}</div></div>
                  ))}
                </div>
            </div>
          </div>
        )}

        {activeView === 'add_lead' && (
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto w-full animate-in fade-in">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900"><UserPlus className="text-indigo-600" /> Enter Store Details</h3>
            <form onSubmit={handleAddLead} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-600 uppercase">Store / Bakery Name</label>
                  <input required placeholder="e.g. Sharma Sweets" className="w-full p-3.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900 placeholder-slate-400 shadow-sm" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-600 uppercase">Store Pincode</label>
                  <input required placeholder="e.g. 751001" maxLength={6} className="w-full p-3.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-900 placeholder-slate-400 shadow-sm" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value.replace(/\D/g,'')})} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-600 uppercase">Contact Person</label>
                  <input placeholder="Owner Name" className="w-full p-3.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 placeholder-slate-400 shadow-sm" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-2 text-slate-600 uppercase">Phone Number</label>
                  <input required placeholder="10-digit mobile" maxLength={10} className="w-full p-3.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-medium text-slate-900 placeholder-slate-400 shadow-sm" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value.replace(/\D/g,'')})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-2 text-slate-600 uppercase">Field Notes (Optional)</label>
                <textarea placeholder="Current supplier, volume requirements, objections..." rows={3} className="w-full p-3.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-900 placeholder-slate-400 shadow-sm" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
              <button type="submit" disabled={isSaving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 mt-4">{isSaving ? <Loader2 size={20} className="animate-spin" /> : 'Drop into Pipeline'}</button>
            </form>
          </div>
        )}

        {activeView === 'territory' && (
          <div className="max-w-3xl mx-auto w-full space-y-6 animate-in fade-in">
            <div className="bg-indigo-600 rounded-2xl p-8 text-white shadow-lg overflow-hidden relative">
              <MapPin size={120} className="absolute -right-10 -bottom-10 opacity-10" />
              <h3 className="text-2xl font-bold mb-2">My Coverage Area</h3>
              <p className="text-indigo-100 mb-6 max-w-md leading-relaxed">Focus your efforts. These are the postal codes assigned to you by the administrative team.</p>
              
              {(!agent?.assigned_pincodes || agent.assigned_pincodes.length === 0) ? (
                <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20 text-center">
                  <p className="font-bold">No territories assigned yet.</p>
                  <p className="text-sm text-indigo-200 mt-1">Please contact your manager to get pincodes assigned.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {agent.assigned_pincodes.map(pin => (
                    <div key={pin} className="bg-white text-indigo-900 px-4 py-2 rounded-lg font-mono font-bold shadow-sm flex items-center gap-2">
                      <MapPin size={14} className="text-indigo-500"/> {pin}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
                <p className="text-slate-500 font-bold uppercase text-xs tracking-wider mb-2">Active Leads</p>
                <p className="text-4xl font-bold text-slate-900">{leads.filter(l => !['Converted', 'Lost'].includes(l.status)).length}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
                <p className="text-slate-500 font-bold uppercase text-xs tracking-wider mb-2">Conversion Rate</p>
                <p className="text-4xl font-bold text-emerald-600">{leads.length > 0 ? Math.round((leads.filter(l => l.status === 'Converted').length / leads.length) * 100) : 0}%</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}