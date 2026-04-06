/* eslint-disable */
// @ts-nocheck
'use client'

import { useEffect, useState, FormEvent, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  PackagePlus, LayoutDashboard, Users, LogOut, ShieldAlert, 
  Loader2, Building2, ShoppingBag, ArrowRight, 
  Check, X, AlertTriangle, Edit, Trash2, ReceiptText, Banknote, 
  TrendingUp, Activity, UploadCloud, Menu, Save, ClipboardList, 
  Calculator, Settings, MessageCircle, Printer, Download, FileSpreadsheet, Search, CheckSquare, Image as ImageIcon
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Client { 
  id: string; company_name: string; client_type: string; email: string; account_status: string; created_at: string; 
  full_name?: string; gst_number?: string; phone_number?: string; organization_role?: string; billing_address?: string; shipping_address?: string;
  credit_limit: number; payment_terms: string; special_instructions?: string; wallet_balance: number; r_cash_balance: number;
}
interface OrderItem { id: string; name: string; price: number; unit: string; quantity: number; }
interface Order { 
  id: string; user_id: string; customer_name: string; total_amount: number; status: string; created_at: string; order_items: OrderItem[]; payment_method?: string;
  freight_charges?: number; toll_charges?: number; loading_charges?: number; packaging_charges?: number; gateway_charges?: number; other_charges?: number;
}
interface Product { id: string; name: string; description: string; category: string; unit: string; stock_quantity: number; price_d2c: number; price_b2b: number; price_distributor: number; price_roti_factory: number; price_retail_modern: number; price_retail_old: number; image_url?: string; image_urls?: string[]; }
interface WalletRequest { id: string; user_id: string; customer_name: string; amount: number; utr_number: string; status: string; created_at: string; }

const isOverdue = (dateString: string) => (new Date().getTime() - new Date(dateString).getTime()) > (24 * 60 * 60 * 1000)

export default function AdminDashboard() {
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [activeView, setActiveView] = useState<'orders' | 'inventory' | 'add' | 'approvals' | 'directory' | 'finance' | 'b2b_orders' | 'settings'>('orders')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [pendingClients, setPendingClients] = useState<Client[]>([])
  const [activeB2BClients, setActiveB2BClients] = useState<Client[]>([])
  const [walletRequests, setWalletRequests] = useState<WalletRequest[]>([]) 
  const [overdueCount, setOverdueCount] = useState(0)
  const [storeSettings, setStoreSettings] = useState({ reward_points_per_unit: 0.5, inr_per_reward_point: 1.0 })

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null) 
  const [selectedClient, setSelectedClient] = useState<Client | null>(null) 
  const [negotiatingOrder, setNegotiatingOrder] = useState<Order | null>(null)
  const [negoForm, setNegoForm] = useState({ freight: 0, toll: 0, loading: 0, packaging: 0, gateway: 0, other: 0 })

  const [isSaving, setIsSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  
  const [addMode, setAddMode] = useState<'single' | 'csv'>('single')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([])

  const [formData, setFormData] = useState({ name: '', description: '', category: 'Retail Flour', unit: 'kg', stock_quantity: '100', price_d2c: '', price_wholesale: '', price_distributor: '', price_roti_factory: '', price_retail_modern: '', price_retail_old: '' })

  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryCategory, setInventoryCategory] = useState('All')
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [bulkEditField, setBulkEditField] = useState('category')
  const [bulkEditValue, setBulkEditValue] = useState('')

  const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0)
  const pendingWalletTotal = walletRequests.reduce((sum, req) => sum + (Number(req.amount) || 0), 0)
  const activeB2BCount = activeB2BClients.length
  const pendingB2BOrdersCount = orders.filter(o => o.status === 'Pending Approval').length

  const fetchOrders = useCallback(async () => { const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }); if (data) setOrders(data as Order[]) }, [])
  const fetchProducts = useCallback(async () => { const { data } = await supabase.from('products').select('*').order('name', { ascending: true }); if (data) setProducts(data as Product[]) }, [])
  const fetchClients = useCallback(async () => {
    const { data } = await supabase.from('user_roles').select('*').neq('role', 'admin')
    if (data) {
      setActiveB2BClients(data.filter(c => c.account_status === 'active' && c.client_type !== 'D2C') as Client[])
      const pending = data.filter(c => c.account_status === 'pending') as Client[]
      setPendingClients(pending); setOverdueCount(pending.filter(c => isOverdue(c.created_at)).length)
    }
  }, [])
  const fetchWalletRequests = useCallback(async () => { const { data } = await supabase.from('wallet_requests').select('*').eq('status', 'Pending').order('created_at', { ascending: false }); if (data) setWalletRequests(data as WalletRequest[]) }, [])
  const fetchSettings = useCallback(async () => { const { data } = await supabase.from('store_settings').select('*').eq('id', 1).single(); if (data) setStoreSettings({ reward_points_per_unit: data.reward_points_per_unit, inr_per_reward_point: data.inr_per_reward_point }) }, [])

  useEffect(() => {
    let isMounted = true
    const initializeAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return window.location.replace('/auth')
      const { data: roleData } = await supabase.from('user_roles').select('role').eq('id', session.user.id).single()
      if (roleData?.role === 'admin' || roleData?.role === 'sales') {
        if (isMounted) setIsAuthorized(true)
        fetchOrders(); fetchClients(); fetchProducts(); fetchWalletRequests(); fetchSettings()
      } else { window.location.replace('/') }
      if (isMounted) setIsLoadingAuth(false)
    }
    initializeAdmin()
    return () => { isMounted = false }
  }, [fetchOrders, fetchClients, fetchProducts, fetchWalletRequests, fetchSettings])

  const inventoryCategories = useMemo(() => { return ['All', ...Array.from(new Set(products.map(p => p.category)))] }, [products])
  const filteredInventory = useMemo(() => {
    return products.filter(p => {
      const matchCat = inventoryCategory === 'All' || p.category === inventoryCategory
      const matchSearch = p.name.toLowerCase().includes(inventorySearch.toLowerCase()) || p.category.toLowerCase().includes(inventorySearch.toLowerCase())
      return matchCat && matchSearch
    })
  }, [products, inventoryCategory, inventorySearch])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setImageFiles(prev => [...prev, ...files])
      const newPreviews = files.map(file => URL.createObjectURL(file))
      setImagePreviews(prev => [...prev, ...newPreviews])
    }
  }

  const removeNewImage = (index: number) => { setImageFiles(prev => prev.filter((_, i) => i !== index)); setImagePreviews(prev => prev.filter((_, i) => i !== index)) }
  const removeExistingImage = (url: string) => { setExistingImageUrls(prev => prev.filter(u => u !== url)) }

  const handleEditClick = (product: Product) => {
    setEditId(product.id); setFormData({ name: product.name, description: product.description, category: product.category, unit: product.unit, stock_quantity: product.stock_quantity.toString(), price_d2c: product.price_d2c.toString(), price_wholesale: product.price_b2b.toString(), price_distributor: product.price_distributor.toString(), price_roti_factory: product.price_roti_factory.toString(), price_retail_modern: product.price_retail_modern.toString(), price_retail_old: product.price_retail_old.toString() })
    setExistingImageUrls(product.image_urls || (product.image_url ? [product.image_url] : [])); setImageFiles([]); setImagePreviews([]); setActiveView('add'); setAddMode('single'); setIsMobileMenuOpen(false) 
  }

  const handleAddProduct = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setIsSaving(true)
    const uploadedUrls: string[] = [...existingImageUrls]
    if (imageFiles.length > 0) {
      toast(`Uploading images...`, { icon: '📸' })
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file)
        if (!uploadError) { const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName); uploadedUrls.push(publicUrl) }
      }
    }
    const productPayload = { name: formData.name, description: formData.description, category: formData.category, unit: formData.unit, stock_quantity: Number(formData.stock_quantity), price_d2c: Number(formData.price_d2c), price_b2b: Number(formData.price_wholesale), price_distributor: Number(formData.price_distributor), price_roti_factory: Number(formData.price_roti_factory), price_retail_modern: Number(formData.price_retail_modern), price_retail_old: Number(formData.price_retail_old), image_urls: uploadedUrls, image_url: uploadedUrls[0] || null }
    const { error } = editId ? await supabase.from('products').update(productPayload).eq('id', editId) : await supabase.from('products').insert([productPayload])
    if (error) { toast.error(error.message) } else {
      toast.success(editId ? 'Product updated!' : 'Product added!'); setFormData({ name: '', description: '', category: 'Retail Flour', unit: 'kg', stock_quantity: '100', price_d2c: '', price_wholesale: '', price_distributor: '', price_roti_factory: '', price_retail_modern: '', price_retail_old: '' }); setEditId(null); setImageFiles([]); setImagePreviews([]); setExistingImageUrls([]); fetchProducts() 
    }
    setIsSaving(false)
  }

  const toggleProductSelection = (id: string) => { setSelectedProductIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]) }
  const toggleAllSelections = () => { if (selectedProductIds.length === filteredInventory.length) setSelectedProductIds([]); else setSelectedProductIds(filteredInventory.map(p => p.id)) }
  const handleBulkDelete = async () => { if(!confirm(`Delete ${selectedProductIds.length} items?`)) return; setIsSaving(true); const { error } = await supabase.from('products').delete().in('id', selectedProductIds); if (!error) { toast.success("Deleted."); setSelectedProductIds([]); fetchProducts() } else { toast.error(error.message) }; setIsSaving(false) }
  const handleApplyBulkEdit = async (e: FormEvent) => { e.preventDefault(); setIsSaving(true); let finalValue: string | number = bulkEditValue; if (['stock_quantity', 'price_d2c', 'price_b2b', 'price_distributor', 'price_roti_factory', 'price_retail_modern', 'price_retail_old'].includes(bulkEditField)) finalValue = Number(bulkEditValue); const { error } = await supabase.from('products').update({ [bulkEditField]: finalValue }).in('id', selectedProductIds); if (!error) { toast.success(`Bulk updated!`); setShowBulkEditModal(false); setSelectedProductIds([]); fetchProducts() } else { toast.error(error.message) }; setIsSaving(false) }
  
  const downloadCSVTemplate = () => {
    const headers = "name,description,category,unit,stock_quantity,price_d2c,price_b2b,price_distributor,price_roti_factory,price_retail_modern,price_retail_old\n"
    const sample = "Premium Chakki Atta,Freshly milled 100% whole wheat,Wheat Flour,kg,500,50,45,42,40,48,49\n"
    const blob = new Blob([headers + sample], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "template.csv"; link.click()
  }

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setIsSaving(true); toast('Importing...');
    const reader = new FileReader(); reader.onload = async ({ target }) => {
      const text = target?.result as string; const lines = text.split('\n'); const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const bulkData = []; for(let i=1; i<lines.length; i++) {
        if(!lines[i].trim()) continue; const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
        const obj: Record<string, string | number> = {}; headers.forEach((h, idx) => {
          if (['stock_quantity', 'price_d2c', 'price_b2b', 'price_distributor', 'price_roti_factory', 'price_retail_modern', 'price_retail_old'].includes(h)) obj[h] = Number(values[idx] || 0); else obj[h] = values[idx] || '';
        }); bulkData.push(obj)
      }; const { error } = await supabase.from('products').insert(bulkData);
      if(!error) { toast.success(`Imported ${bulkData.length} SKUs!`); fetchProducts(); setAddMode('single') } else { toast.error(error.message) }; setIsSaving(false)
    }; reader.readAsText(file)
  }

  const handleSaveSettings = async (e: FormEvent) => { e.preventDefault(); setIsSaving(true); const { error } = await supabase.from('store_settings').update({ reward_points_per_unit: storeSettings.reward_points_per_unit, inr_per_reward_point: storeSettings.inr_per_reward_point }).eq('id', 1); if (!error) toast.success('Settings Saved!'); else toast.error(error.message); setIsSaving(false) }
  const advancePipeline = async (id: string, cur: string) => { const pipe = ['New Order', 'Processing (Milling)', 'Dispatched', 'Delivered']; const idx = pipe.indexOf(cur); if (idx < pipe.length - 1) { await supabase.from('orders').update({ status: pipe[idx + 1] }).eq('id', id); toast.success(`Advanced!`); fetchOrders() } }
  
  const handleApproveB2BOrder = async (e: FormEvent) => {
    e.preventDefault(); if (!negotiatingOrder) return; setIsSaving(true);
    const total = Number(negotiatingOrder.total_amount) + Number(negoForm.freight) + Number(negoForm.toll) + Number(negoForm.loading) + Number(negoForm.packaging) + Number(negoForm.gateway) + Number(negoForm.other);
    const { error } = await supabase.from('orders').update({ status: 'Awaiting Payment', total_amount: total, freight_charges: negoForm.freight, toll_charges: negoForm.toll, loading_charges: negoForm.loading, packaging_charges: negoForm.packaging, gateway_charges: negoForm.gateway, other_charges: negoForm.other }).eq('id', negotiatingOrder.id);
    if (!error) { toast.success('Approved!'); const { data } = await supabase.from('user_roles').select('phone_number').eq('id', negotiatingOrder.user_id).single(); const phone = data?.phone_number || ''; if(phone) window.open(`https://wa.me/91${phone.replace(/\D/g,'').slice(-10)}?text=${encodeURIComponent('B2B Order Approved. Total: ₹'+total)}`, '_blank'); setNegotiatingOrder(null); fetchOrders() } else { toast.error(error.message) }; setIsSaving(false)
  }

  const approveWalletRequest = async (id: string, uid: string, amt: number) => { const { data: u } = await supabase.from('user_roles').select('wallet_balance').eq('id', uid).single(); await supabase.from('user_roles').update({ wallet_balance: (u?.wallet_balance || 0) + amt }).eq('id', uid); await supabase.from('wallet_requests').update({ status: 'Approved' }).eq('id', id); toast.success(`Verified!`); fetchWalletRequests(); fetchClients() }
  const handleApprovalAction = async (id: string, s: string) => { await supabase.from('user_roles').update({ account_status: s }).eq('id', id); toast.success(`Client ${s}!`); fetchClients() }
  const handleSaveClientCRM = async (e: FormEvent) => { e.preventDefault(); if(!selectedClient) return; setIsSaving(true); const { error } = await supabase.from('user_roles').update({ credit_limit: selectedClient.credit_limit, payment_terms: selectedClient.payment_terms, special_instructions: selectedClient.special_instructions }).eq('id', selectedClient.id); if (!error) { toast.success("CRM Updated!"); fetchClients(); setSelectedClient(null) } else { toast.error(error.message) }; setIsSaving(false) }
  const handleDeleteProductActual = async (id: string) => { if(confirm("Delete product?")) { await supabase.from('products').delete().eq('id', id); toast.success("Deleted."); fetchProducts() } }
  const handleNavClick = (view: any) => { setActiveView(view); setIsMobileMenuOpen(false); setSelectedProductIds([]) }

  if (isLoadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 size={48} className="animate-spin text-indigo-600" /></div>
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center text-center p-12 font-bold"><ShieldAlert size={64} className="mx-auto text-red-500 mb-4" />Access Denied</div>

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row w-full overflow-x-hidden">
      <div className="md:hidden bg-slate-900 text-white h-16 flex items-center justify-between px-4 sticky top-0 z-30 shrink-0 shadow-md">
        <div className="font-bold text-lg tracking-tight flex items-center gap-2"><div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-inner">R</div>RGDB Admin</div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -mr-2 text-slate-300 hover:text-white rounded-full transition-colors"><Menu size={24} /></button>
      </div>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0"><span className="text-white font-bold text-lg tracking-tight">RGDB Admin</span><button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white transition-colors"><X size={20}/></button></div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto text-sm">
          <button onClick={() => handleNavClick('orders')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === 'orders' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><ShoppingBag size={20} /> Dashboard & Orders</button>
          <button onClick={() => handleNavClick('b2b_orders')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${activeView === 'b2b_orders' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><div className="flex items-center gap-3"><ClipboardList size={20} /> B2B Approvals</div>{pendingB2BOrdersCount > 0 && <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingB2BOrdersCount}</span>}</button>
          <button onClick={() => handleNavClick('finance')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${activeView === 'finance' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><div className="flex items-center gap-3"><Banknote size={20} /> Finance & Wallet</div>{walletRequests.length > 0 && <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{walletRequests.length}</span>}</button>
          <button onClick={() => { handleNavClick('add'); setEditId(null); setImagePreviews([]); setImageFiles([]); setExistingImageUrls([]); setFormData({ name: '', description: '', category: 'Retail Flour', unit: 'kg', stock_quantity: '100', price_d2c: '', price_wholesale: '', price_distributor: '', price_roti_factory: '', price_retail_modern: '', price_retail_old: '' }) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === 'add' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><PackagePlus size={20} /> Add Products</button>
          <button onClick={() => handleNavClick('inventory')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === 'inventory' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><LayoutDashboard size={20} /> Live Inventory</button>
          <button onClick={() => handleNavClick('approvals')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${activeView === 'approvals' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><div className="flex items-center gap-3"><Users size={20} /> Activations</div></button>
          <button onClick={() => handleNavClick('directory')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === 'directory' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Building2 size={20} /> Client CRM</button>
          <button onClick={() => handleNavClick('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === 'settings' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Settings size={20} /> Store Rewards</button>
        </nav>
        <div className="p-4 border-t border-slate-800 shrink-0"><button onClick={() => { toast('Logging out...'); supabase.auth.signOut(); window.location.replace('/auth'); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 hover:text-red-400 transition-colors rounded-xl font-bold"><LogOut size={20} /> Logout</button></div>
      </aside>

      <main className="flex-1 w-full max-w-full p-4 md:p-8 overflow-x-hidden">
        <header className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 md:mb-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">{activeView.replace('_', ' ')}</h2>
          {overdueCount > 0 && <div className="bg-rose-100 text-rose-700 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2"><AlertTriangle size={18}/> {overdueCount} Overdue Requests</div>}
        </header>

        {activeView === 'settings' && (
          <div className="bg-white p-8 rounded-2xl border max-w-2xl animate-in fade-in shadow-sm">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings className="text-indigo-600" /> Reward System</h3>
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div><label className="block text-xs font-bold mb-2 uppercase">R-Cash Per Unit (kg/liter)</label><input type="number" step="0.1" required className="w-full p-3 bg-slate-50 border rounded-xl font-bold" value={storeSettings.reward_points_per_unit} onChange={e => setStoreSettings({...storeSettings, reward_points_per_unit: Number(e.target.value)})} /></div>
              <div><label className="block text-xs font-bold mb-2 uppercase">INR Value per R-Cash Point</label><input type="number" step="0.1" required className="w-full p-3 bg-slate-50 border rounded-xl font-bold" value={storeSettings.inr_per_reward_point} onChange={e => setStoreSettings({...storeSettings, inr_per_reward_point: Number(e.target.value)})} /></div>
              <button type="submit" disabled={isSaving} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-md flex items-center justify-center gap-2"><Save size={18}/> Update System</button>
            </form>
          </div>
        )}

        {activeView === 'orders' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {['New Order', 'Processing (Milling)', 'Dispatched', 'Delivered'].map(stage => (
              <div key={stage} className="bg-slate-100 p-4 rounded-2xl border min-h-125 flex flex-col">
                <h3 className="font-bold text-slate-700 mb-4 uppercase text-[10px] tracking-widest">{stage}</h3>
                <div className="space-y-4 flex-1">
                  {orders.filter(o => o.status === stage).map(order => (
                    <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border group">
                      <div className="flex justify-between items-start mb-1 text-[10px] font-mono text-slate-400 uppercase">#{order.id.split('-')[0]}<button onClick={() => setSelectedOrder(order)} className="text-indigo-600"><ReceiptText size={14}/></button></div>
                      <div className="font-bold text-slate-900 leading-tight mb-1">{order.customer_name}</div>
                      <div className="text-emerald-600 font-bold text-sm">₹{order.total_amount.toLocaleString()}</div>
                      {stage !== 'Delivered' && <button onClick={() => advancePipeline(order.id, order.status)} className="mt-4 w-full bg-indigo-50 text-indigo-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-indigo-100">Advance <ArrowRight size={14}/></button>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeView === 'add' && (
          <div className="bg-white p-8 rounded-2xl border max-w-4xl shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold flex items-center gap-2"><PackagePlus className="text-indigo-600" /> Catalog</h3>
              {!editId && <div className="flex bg-slate-100 p-1 rounded-xl"><button onClick={() => setAddMode('single')} className={`px-4 py-2 rounded-lg text-xs font-bold ${addMode === 'single' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>Single</button><button onClick={() => setAddMode('csv')} className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 ${addMode === 'csv' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}><FileSpreadsheet size={14}/> CSV</button></div>}
            </div>
            {addMode === 'single' ? (
              <form onSubmit={handleAddProduct} className="space-y-8">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  {existingImageUrls.map((url, i) => (<div key={i} className="relative aspect-square rounded-xl overflow-hidden border group"><img src={url} className="w-full h-full object-cover" alt=""/><button type="button" onClick={() => removeExistingImage(url)} className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"><X size={12}/></button></div>))}
                  {imagePreviews.map((src, i) => (<div key={i} className="relative aspect-square rounded-xl border-2 border-indigo-200 overflow-hidden group"><img src={src} className="w-full h-full object-cover" alt=""/><button type="button" onClick={() => removeNewImage(i)} className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"><X size={12}/></button></div>))}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer"><UploadCloud size={24}/><input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden"/></label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><input required placeholder="Name" className="w-full p-3 bg-slate-50 border rounded-xl" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /><input required placeholder="Category" className="w-full p-3 bg-slate-50 border rounded-xl" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} /></div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6"><select className="p-3 bg-slate-50 border rounded-xl font-medium" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}><option value="kg">kg</option><option value="liter">liter</option><option value="packet">packet</option></select><input required type="number" placeholder="Stock" className="col-span-2 p-3 bg-slate-50 border rounded-xl font-bold" value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: e.target.value})} /></div>
                <textarea required placeholder="Description" rows={3} className="w-full p-3 bg-slate-50 border rounded-xl" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border">
                  {['price_d2c', 'price_wholesale', 'price_distributor', 'price_roti_factory', 'price_retail_modern', 'price_retail_old'].map(f => (
                    <div key={f} className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">{f.replace('price_', '').replace('_', ' ')} ₹</label><input required type="number" className="w-full p-2 border rounded-lg" value={(formData as any)[f]} onChange={e => setFormData({...formData, [f]: e.target.value})} /></div>
                  ))}
                </div>
                <button type="submit" disabled={isSaving} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2">{isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} {editId ? 'Update' : 'Save'} SKU</button>
              </form>
            ) : (
              <div className="space-y-8 text-center py-8">
                <div className="bg-indigo-50 border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-left"><h4 className="font-bold text-indigo-900 mb-1">CSV Bulk Upload</h4><p className="text-sm text-indigo-700">Populate your inventory instantly via Excel.</p></div>
                  <button onClick={downloadCSVTemplate} className="bg-white text-indigo-700 px-6 py-2 rounded-xl font-bold shadow-sm flex items-center gap-2"><Download size={18}/> Template</button>
                </div>
                <label className="block w-full border-2 border-dashed border-slate-300 rounded-3xl p-16 hover:bg-slate-50 cursor-pointer transition-all"><UploadCloud size={48} className="mx-auto text-slate-300 mb-4"/><p className="font-bold text-slate-600">Select CSV File</p><p className="text-xs text-slate-400 mt-2">Maximum 5,000 SKUs per upload</p><input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden"/></label>
              </div>
            )}
          </div>
        )}

        {activeView === 'inventory' && (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 justify-between bg-white p-4 rounded-2xl border shadow-sm items-center">
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 lg:w-64"><Search className="absolute left-3 top-2.5 text-slate-400" size={18}/><input type="text" placeholder="Search..." value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border rounded-full text-sm outline-none" /></div>
                <select value={inventoryCategory} onChange={e => setInventoryCategory(e.target.value)} className="bg-slate-50 border text-slate-700 text-sm py-2 px-4 rounded-full font-medium">{inventoryCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
              </div>
              {selectedProductIds.length > 0 && (
                <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-xl border-indigo-100 border shrink-0">
                  <span className="text-xs font-bold text-indigo-800">{selectedProductIds.length} Selection</span>
                  <button onClick={() => setShowBulkEditModal(true)} className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold">Bulk Edit</button>
                  <button onClick={handleBulkDelete} className="text-rose-600"><Trash2 size={16}/></button>
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl border shadow-sm w-full overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left whitespace-nowrap min-w-150">
                  <thead className="bg-slate-50 border-b text-xs text-slate-500 font-bold uppercase">
                    <tr>
                      <th className="p-4 w-12"><button onClick={toggleAllSelections} className={`w-5 h-5 rounded border flex items-center justify-center ${selectedProductIds.length === filteredInventory.length && filteredInventory.length > 0 ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>{selectedProductIds.length === filteredInventory.length && filteredInventory.length > 0 && <Check size={12}/>}</button></th>
                      <th className="p-4">SKU Info</th><th className="p-4 text-center">Stock</th><th className="p-4 text-center">Price</th><th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {filteredInventory.map(p => (
                      <tr key={p.id} className={selectedProductIds.includes(p.id) ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}>
                        <td className="p-4"><button onClick={() => toggleProductSelection(p.id)} className={`w-5 h-5 rounded border flex items-center justify-center ${selectedProductIds.includes(p.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>{selectedProductIds.includes(p.id) && <Check size={12}/>}</button></td>
                        <td className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden border">{p.image_urls?.[0] || p.image_url ? <img src={p.image_urls?.[0] || p.image_url} className="w-full h-full object-cover" alt=""/> : <ImageIcon size={18} className="m-auto text-slate-300"/>}</div><div><div className="font-bold text-slate-900">{p.name}</div><div className="text-[10px] text-slate-400">{p.category}</div></div></div></td>
                        <td className="p-4 text-center font-mono font-bold text-slate-700">{p.stock_quantity} {p.unit}</td><td className="p-4 text-center font-bold text-emerald-600">₹{p.price_d2c}</td>
                        <td className="p-4 text-right"><div className="flex justify-end gap-1"><button onClick={() => handleEditClick(p)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit size={16}/></button><button onClick={() => handleDeleteProductActual(p.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeView === 'b2b_orders' && (
          <div className="space-y-4">
            <h3 className="text-lg md:text-xl font-bold mb-4 text-slate-800">Pending B2B Approvals</h3>
            {orders.filter(o => o.status === 'Pending Approval').length === 0 ? <div className="p-12 bg-white rounded-2xl text-center text-slate-400 border border-slate-200">No pending requests.</div> : orders.filter(o => o.status === 'Pending Approval').map(order => (
              <div key={order.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm gap-4">
                <div><div className="font-bold text-lg text-slate-900">{order.customer_name}</div><div className="text-amber-600 font-mono text-xs bg-amber-50 px-2 py-1 rounded inline-block mt-1">#{order.id.split('-')[0].toUpperCase()}</div><div className="text-slate-400 text-xs mt-2">{new Date(order.created_at).toLocaleString()}</div></div>
                <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-0 pt-4 md:pt-0"><div className="text-2xl font-bold text-slate-900">₹{order.total_amount.toLocaleString()}</div><button onClick={() => { setNegotiatingOrder(order); setNegoForm({ freight: 0, toll: 0, loading: 0, packaging: 0, gateway: 0, other: 0 }); }} className="bg-amber-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2"><Calculator size={18}/> Review & Quote</button></div>
              </div>
            ))}
          </div>
        )}

        {activeView === 'finance' && (
          <div className="space-y-4">
            <h3 className="text-lg md:text-xl font-bold mb-4 text-slate-800">Wallet Reload Requests</h3>
            {walletRequests.length === 0 ? <div className="p-12 bg-white rounded-2xl text-center text-slate-400 border border-slate-200">No requests.</div> : walletRequests.map(req => (
              <div key={req.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm gap-4">
                <div className="w-full md:w-auto"><div className="font-bold text-lg text-slate-900">{req.customer_name}</div><div className="text-indigo-600 font-mono text-xs bg-indigo-50 px-2 py-1 rounded inline-block mt-1">UTR: {req.utr_number}</div></div>
                <div className="flex items-center gap-4 w-full md:w-auto pt-4 border-t md:border-0 md:pt-0"><div className="text-2xl font-bold text-emerald-600">₹{req.amount.toLocaleString()}</div><button onClick={() => approveWalletRequest(req.id, req.user_id, req.amount)} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2"><Check size={18}/> Verify</button></div>
              </div>
            ))}
          </div>
        )}

        {activeView === 'approvals' && (
          <div className="space-y-4">
            <h3 className="text-lg md:text-xl font-bold mb-4 text-slate-800">New Client Activation</h3>
            {pendingClients.length === 0 ? <div className="p-12 bg-white rounded-2xl text-center text-slate-400 border border-slate-200">No pending accounts.</div> : pendingClients.map(client => (<div key={client.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"><div><div className="font-bold text-lg text-slate-900">{client.company_name}</div><div className="text-slate-500 text-sm mt-1 bg-slate-100 px-2 py-0.5 rounded inline-block">{client.client_type}</div></div><button onClick={() => handleApprovalAction(client.id, 'active')} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md"><Check size={18}/> Approve Account</button></div>))}
          </div>
        )}

        {activeView === 'directory' && (
           <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full overflow-hidden animate-in slide-in-from-bottom-4"><div className="overflow-x-auto w-full"><table className="w-full text-left whitespace-nowrap min-w-125"><thead className="bg-slate-50 border-b border-slate-200"><tr><th className="p-4 text-xs font-bold text-slate-500 uppercase">Company / Name</th><th className="p-4 text-xs font-bold text-slate-500 uppercase">Tier & Terms</th><th className="p-4 text-xs font-bold text-slate-500 uppercase">Wallet Balance</th><th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{activeB2BClients.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-slate-500">No partners.</td></tr> : activeB2BClients.map(c => (<tr key={c.id} className="hover:bg-slate-50 transition-colors"><td className="p-4"><div className="font-bold text-slate-900">{c.company_name || c.full_name}</div><div className="text-xs text-slate-500">{c.email}</div></td><td className="p-4"><span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase">{c.client_type}</span></td><td className="p-4 font-mono font-bold text-emerald-600">₹{(c.wallet_balance || 0).toLocaleString()}</td><td className="p-4 text-right"><button onClick={() => setSelectedClient(c)} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold">Manage CRM</button></td></tr>))}</tbody></table></div></div>
        )}
      </main>

      {/* BULK EDIT MODAL */}
      {showBulkEditModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowBulkEditModal(false)}></div><div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95"><h3 className="text-xl font-bold text-slate-900 mb-1">Bulk Edit</h3><p className="text-sm text-slate-500 mb-6">Updating <strong className="text-indigo-600">{selectedProductIds.length}</strong> items.</p><form onSubmit={handleApplyBulkEdit} className="space-y-4"><div><label className="block text-xs font-bold mb-2">Field</label><select value={bulkEditField} onChange={(e) => setBulkEditField(e.target.value)} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"><option value="category">Category</option><option value="stock_quantity">Stock</option><option value="price_d2c">Retail Price</option><option value="price_b2b">Wholesale Price</option></select></div><div><label className="block text-xs font-bold mb-2">New Value</label><input required type={['category'].includes(bulkEditField) ? "text" : "number"} className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={bulkEditValue} onChange={(e) => setBulkEditValue(e.target.value)} /></div><div className="flex gap-3 justify-end pt-4"><button type="button" onClick={() => setShowBulkEditModal(false)} className="px-5 py-2.5 font-bold text-slate-600">Cancel</button><button type="submit" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold">Apply Changes</button></div></form></div></div>
      )}

      {/* CRM MODAL */}
      {selectedClient && (
         <div className="fixed inset-0 z-60 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedClient(null)}></div><div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"><div className="bg-slate-50 p-5 md:p-6 border-b border-slate-200 flex justify-between items-center shrink-0"><div><h3 className="text-xl font-bold text-slate-900">{selectedClient.company_name || 'Client Profile'}</h3><div className="flex gap-2 mt-1"><span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs font-bold uppercase">{selectedClient.client_type}</span>{selectedClient.gst_number && <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs font-mono font-bold uppercase">GST: {selectedClient.gst_number}</span>}</div></div><button onClick={() => setSelectedClient(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button></div><div className="p-5 md:p-6 overflow-y-auto flex-1 bg-slate-50/50"><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div><h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Customer Details</h4><div className="space-y-3 text-sm"><p><span className="text-slate-500 w-24 inline-block">Contact:</span> <span className="font-bold text-slate-900">{selectedClient.full_name || '-'}</span></p><p><span className="text-slate-500 w-24 inline-block">Email:</span> <span className="font-medium text-slate-900">{selectedClient.email}</span></p><p><span className="text-slate-500 w-24 inline-block">Phone:</span> <span className="font-medium text-slate-900">{selectedClient.phone_number || '-'}</span></p><div className="pt-2"><span className="text-slate-500 block mb-1">Billing Address:</span><p className="font-medium text-slate-900 bg-white p-3 rounded-lg border border-slate-200 text-xs whitespace-pre-wrap">{selectedClient.billing_address || '-'}</p></div></div></div><div><h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Admin Controls</h4><form id="crm-form" onSubmit={handleSaveClientCRM} className="space-y-4"><div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center mb-4"><span className="text-sm font-bold text-emerald-800">Ledger</span><span className="text-xl font-bold text-emerald-600">₹{(selectedClient.wallet_balance || 0).toLocaleString()}</span></div><div><label className="block text-xs font-bold text-slate-600 uppercase mb-1">Credit Limit</label><input type="number" className="w-full p-3 border rounded-xl" value={selectedClient.credit_limit || 0} onChange={(e) => setSelectedClient({...selectedClient, credit_limit: Number(e.target.value)})} /></div><div><label className="block text-xs font-bold text-slate-600 uppercase mb-1">Terms</label><select className="w-full p-3 border rounded-xl" value={selectedClient.payment_terms || 'Prepaid'} onChange={(e) => setSelectedClient({...selectedClient, payment_terms: e.target.value})}><option value="Prepaid">Prepaid</option><option value="Net 15">Net 15</option><option value="Net 30">Net 30</option></select></div><div><label className="block text-xs font-bold text-slate-600 uppercase mb-1">Notes</label><textarea rows={3} className="w-full p-3 border rounded-xl text-sm" value={selectedClient.special_instructions || ''} onChange={(e) => setSelectedClient({...selectedClient, special_instructions: e.target.value})} /></div></form></div></div></div><div className="bg-white p-5 border-t flex justify-end gap-3"><button onClick={() => setSelectedClient(null)} className="px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-100 transition-colors rounded-xl">Cancel</button><button type="submit" form="crm-form" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md">Save CRM</button></div></div></div>
      )}

      {/* NEGOTIATION MODAL */}
      {negotiatingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setNegotiatingOrder(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 p-5 md:p-6 border-b border-slate-200 flex justify-between items-center shrink-0"><div><h3 className="text-xl font-bold text-slate-900">B2B Order Quote</h3><p className="text-sm font-mono text-slate-500 uppercase mt-0.5">#{negotiatingOrder.id.split('-')[0]}</p></div><button onClick={() => setNegotiatingOrder(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button></div>
            <div className="p-5 md:p-6 overflow-y-auto flex-1 bg-slate-50/50 flex flex-col lg:flex-row gap-8">
              <div className="flex-1"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Order Summary</h4><div className="space-y-3 mb-6">{negotiatingOrder.order_items.map((item, idx) => (<div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 text-sm"><div><span className="font-bold text-slate-900">{item.name}</span><span className="text-slate-500 block text-xs">{item.quantity} {item.unit} @ ₹{item.price}</span></div><div className="font-bold text-slate-800">₹{(item.quantity * item.price).toLocaleString()}</div></div>))}</div><div className="flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100"><span className="font-bold text-indigo-900">Base Materials Total</span><span className="text-lg font-bold text-indigo-700">₹{negotiatingOrder.total_amount.toLocaleString()}</span></div></div>
              <div className="w-full lg:w-80 shrink-0"><h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Apply Charges</h4><form id="negotiation-form" onSubmit={handleApproveB2BOrder} className="space-y-3"><div className="flex items-center justify-between gap-4"><label className="text-xs font-bold text-slate-600">Freight</label><div className="relative w-28"><span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span><input type="number" className="w-full pl-7 p-2 text-right border rounded-lg text-sm font-bold" value={negoForm.freight} onChange={e => setNegoForm({...negoForm, freight: Number(e.target.value)})} /></div></div><div className="flex items-center justify-between gap-4"><label className="text-xs font-bold text-slate-600">Tolls</label><div className="relative w-28"><span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span><input type="number" className="w-full pl-7 p-2 text-right border rounded-lg text-sm font-bold" value={negoForm.toll} onChange={e => setNegoForm({...negoForm, toll: Number(e.target.value)})} /></div></div><div className="flex items-center justify-between gap-4"><label className="text-xs font-bold text-slate-600">Loading</label><div className="relative w-28"><span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span><input type="number" className="w-full pl-7 p-2 text-right border rounded-lg text-sm font-bold" value={negoForm.loading} onChange={e => setNegoForm({...negoForm, loading: Number(e.target.value)})} /></div></div><div className="flex items-center justify-between gap-4"><label className="text-xs font-bold text-slate-600">Packaging</label><div className="relative w-28"><span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span><input type="number" className="w-full pl-7 p-2 text-right border rounded-lg text-sm font-bold" value={negoForm.packaging} onChange={e => setNegoForm({...negoForm, packaging: Number(e.target.value)})} /></div></div><div className="flex items-center justify-between gap-4"><label className="text-xs font-bold text-slate-600">Gateway</label><div className="relative w-28"><span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span><input type="number" className="w-full pl-7 p-2 text-right border rounded-lg text-sm font-bold" value={negoForm.gateway} onChange={e => setNegoForm({...negoForm, gateway: Number(e.target.value)})} /></div></div><div className="flex items-center justify-between gap-4"><label className="text-xs font-bold text-slate-600">Other</label><div className="relative w-28"><span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span><input type="number" className="w-full pl-7 p-2 text-right border rounded-lg text-sm font-bold" value={negoForm.other} onChange={e => setNegoForm({...negoForm, other: Number(e.target.value)})} /></div></div><div className="pt-4 mt-4 border-t border-slate-300"><div className="flex justify-between items-center mb-1"><span className="text-sm font-bold text-slate-900">Final Total</span><span className="text-2xl font-bold text-amber-600">₹{(negotiatingOrder.total_amount + Number(negoForm.freight) + Number(negoForm.toll) + Number(negoForm.loading) + Number(negoForm.packaging) + Number(negoForm.gateway) + Number(negoForm.other)).toLocaleString()}</span></div></div></form></div>
            </div>
            <div className="bg-white p-5 border-t border-slate-200 flex justify-end shrink-0 gap-3"><button onClick={() => setNegotiatingOrder(null)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button><button type="submit" form="negotiation-form" disabled={isSaving} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md">{isSaving ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />} Approve & WA</button></div>
          </div>
        </div>
      )}

      {/* INVOICE MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:block">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm print:hidden" onClick={() => setSelectedOrder(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 print:shadow-none print:w-full print:max-w-full print:rounded-none flex flex-col max-h-[90vh] md:max-h-[85vh]">
            <div className="bg-slate-50 p-4 md:p-6 border-b border-slate-200 flex justify-between items-center shrink-0 print:bg-white"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl print:bg-black">R</div><div><h3 className="text-xl font-bold text-slate-900">Tax Invoice</h3><p className="text-sm font-mono text-slate-500 uppercase">#{selectedOrder.id.split('-')[0]}</p></div></div><div className="flex gap-2 print:hidden"><button onClick={() => window.print()} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-2 font-bold text-sm"><Printer size={16}/> Print</button><button onClick={() => setSelectedOrder(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg"><X size={20}/></button></div></div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex flex-col sm:flex-row justify-between mb-6 pb-6 border-b border-dashed gap-4"><div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Billed To</p><p className="font-bold text-lg text-slate-900">{selectedOrder.customer_name}</p></div><div className="sm:text-right"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p><p className="font-medium text-indigo-600">{selectedOrder.status}</p></div></div>
              <table className="w-full text-left whitespace-nowrap min-w-100">
                <thead className="bg-slate-50 border-y border-slate-200"><tr><th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Item</th><th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-right">Qty</th><th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-right">Price</th><th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-right">Total</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{selectedOrder.order_items.map((item, idx) => (<tr key={idx}><td className="py-4 px-4 font-bold text-slate-900">{item.name}</td><td className="py-4 px-4 text-slate-600 text-right">{item.quantity} {item.unit}</td><td className="py-4 px-4 text-slate-600 text-right">₹{item.price}</td><td className="py-4 px-4 font-bold text-slate-800 text-right">₹{(item.quantity * item.price).toLocaleString()}</td></tr>))}</tbody>
              </table>
            </div>
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center shrink-0 print:bg-black"><p className="text-slate-400 text-sm mb-1">Grand Total</p><p className="text-2xl font-bold text-white">₹{selectedOrder.total_amount.toLocaleString()}</p></div>
          </div>
        </div>
      )}
    </div>
  )
}