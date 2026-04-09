/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState, FormEvent, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  LayoutDashboard, PackagePlus, Search, Download, UploadCloud, 
  Check, Image as ImageIcon, Edit, Trash2, UserCircle, 
  Loader2, LogOut, Menu, X, ShieldCheck, AlertCircle, Save, FileSpreadsheet
} from 'lucide-react'
import toast from 'react-hot-toast'

// --- Interfaces ---
interface UserProfile { id: string; full_name: string; email: string; role: string; employee_number?: string; emergency_contact?: string; id_proof_number?: string; }
interface Product { id: string; name: string; description: string; category: string; unit: string; stock_quantity: number; price_d2c: number; price_b2b: number; price_distributor: number; price_roti_factory: number; price_retail_modern: number; price_retail_old: number; image_url?: string; image_urls?: string[]; }

export default function InventoryHub() {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [manager, setManager] = useState<UserProfile | null>(null)
  
  const [activeView, setActiveView] = useState<'inventory' | 'add' | 'profile'>('inventory')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --- Data States ---
  const [products, setProducts] = useState<Product[]>([])
  
  // --- Form & UI States ---
  const [hrForm, setHrForm] = useState({ employee_number: '', emergency_contact: '', id_proof_number: '' })
  
  const [editId, setEditId] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<'single' | 'csv'>('single')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([])
  const [formData, setFormData] = useState({ name: '', description: '', category: 'Retail Flour', unit: 'kg', stock_quantity: '100', price_d2c: '', price_wholesale: '', price_distributor: '', price_roti_factory: '', price_retail_modern: '', price_retail_old: '' })

  // --- Inventory Search & Bulk States ---
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryCategory, setInventoryCategory] = useState('All')
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [bulkEditField, setBulkEditField] = useState<string>('category')
  const [bulkEditValue, setBulkEditValue] = useState('')

  const fetchInventoryData = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').order('name', { ascending: true })
    if (data) setProducts(data as Product[])
  }, [])

  useEffect(() => {
    let isMounted = true
    const initInventory = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return window.location.replace('/auth')
      
      const { data: roleData } = await supabase.from('user_roles').select('*').eq('id', session.user.id).single()
      
      // Strict MECE Role Check: Only Inventory (or Admin overlay) can access
      if (roleData?.role === 'inventory' || roleData?.role === 'admin') {
        if (isMounted) {
          setIsAuthorized(true)
          setManager(roleData as UserProfile)
          setHrForm({ employee_number: roleData.employee_number || '', emergency_contact: roleData.emergency_contact || '', id_proof_number: roleData.id_proof_number || '' })
          fetchInventoryData()
        }
      } else { window.location.replace('/') }
      
      if (isMounted) setIsLoadingAuth(false)
    }
    initInventory()
    return () => { isMounted = false }
  }, [fetchInventoryData])

  // --- Inventory Computations ---
  const inventoryCategories = useMemo(() => { return ['All', ...Array.from(new Set(products.map(p => p.category)))] }, [products])
  const filteredInventory = useMemo(() => { return products.filter(p => { const matchCat = inventoryCategory === 'All' || p.category === inventoryCategory; const matchSearch = p.name.toLowerCase().includes(inventorySearch.toLowerCase()) || p.category.toLowerCase().includes(inventorySearch.toLowerCase()); return matchCat && matchSearch }) }, [products, inventoryCategory, inventorySearch])

  // --- Actions: HR Profile ---
  const handleUpdateHR = async (e: FormEvent) => {
    e.preventDefault(); if (!manager) return; setIsSubmitting(true)
    const { error } = await supabase.from('user_roles').update(hrForm).eq('id', manager.id)
    if (!error) { toast.success('Profile Updated!'); setManager({ ...manager, ...hrForm }) } 
    else { toast.error(error.message) }
    setIsSubmitting(false)
  }

  // --- Actions: Single Product Management ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) { const files = Array.from(e.target.files); setImageFiles(prev => [...prev, ...files]); setImagePreviews(prev => [...prev, ...files.map(file => URL.createObjectURL(file))]) } }
  const removeNewImage = (index: number) => { setImageFiles(prev => prev.filter((_, i) => i !== index)); setImagePreviews(prev => prev.filter((_, i) => i !== index)) }
  const removeExistingImage = (url: string) => { setExistingImageUrls(prev => prev.filter(u => u !== url)) }
  
  const handleEditClick = (product: Product) => { setEditId(product.id); setFormData({ name: product.name, description: product.description, category: product.category, unit: product.unit, stock_quantity: product.stock_quantity.toString(), price_d2c: product.price_d2c.toString(), price_wholesale: product.price_b2b.toString(), price_distributor: product.price_distributor.toString(), price_roti_factory: product.price_roti_factory.toString(), price_retail_modern: product.price_retail_modern.toString(), price_retail_old: product.price_retail_old.toString() }); setExistingImageUrls(product.image_urls || (product.image_url ? [product.image_url] : [])); setImageFiles([]); setImagePreviews([]); setActiveView('add'); setAddMode('single'); setIsMobileMenuOpen(false) }

  const handleDeleteProduct = async (id: string) => {
    if(window.confirm("Are you sure you want to delete this product?")) {
      setIsSubmitting(true)
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (!error) { toast.success("Product Deleted."); fetchInventoryData() }
      else { toast.error(error.message) }
      setIsSubmitting(false)
    }
  }

  const handleAddProduct = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setIsSubmitting(true)
    const uploadedUrls: string[] = [...existingImageUrls]
    
    if (imageFiles.length > 0) {
      toast(`Uploading images...`, { icon: '📸' })
      for (const file of imageFiles) {
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${file.name.split('.').pop()}`
        const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file)
        if (!uploadError) uploadedUrls.push(supabase.storage.from('product-images').getPublicUrl(fileName).data.publicUrl)
      }
    }

    const productPayload = { 
      name: formData.name, description: formData.description, category: formData.category, unit: formData.unit, 
      stock_quantity: Number(formData.stock_quantity), price_d2c: Number(formData.price_d2c), price_b2b: Number(formData.price_wholesale), 
      price_distributor: Number(formData.price_distributor), price_roti_factory: Number(formData.price_roti_factory), 
      price_retail_modern: Number(formData.price_retail_modern), price_retail_old: Number(formData.price_retail_old), 
      image_urls: uploadedUrls, image_url: uploadedUrls[0] || null 
    }

    const { error } = editId 
      ? await supabase.from('products').update(productPayload).eq('id', editId) 
      : await supabase.from('products').insert([productPayload])

    if (!error) { 
      toast.success(editId ? 'Product updated!' : 'Product added!'); 
      setFormData({ name: '', description: '', category: 'Retail Flour', unit: 'kg', stock_quantity: '100', price_d2c: '', price_wholesale: '', price_distributor: '', price_roti_factory: '', price_retail_modern: '', price_retail_old: '' }); 
      setEditId(null); setImageFiles([]); setImagePreviews([]); setExistingImageUrls([]); fetchInventoryData(); setActiveView('inventory') 
    } else { toast.error(error.message) }
    setIsSubmitting(false)
  }

  // --- Actions: Bulk Operations ---
  const toggleProductSelection = (id: string) => { setSelectedProductIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]) }
  const toggleAllSelections = () => { if (selectedProductIds.length === filteredInventory.length) setSelectedProductIds([]); else setSelectedProductIds(filteredInventory.map(p => p.id)) }
  
  const handleBulkDelete = async () => { if(!window.confirm(`Delete ${selectedProductIds.length} items?`)) return; setIsSubmitting(true); const { error } = await supabase.from('products').delete().in('id', selectedProductIds); if (!error) { toast.success("Deleted."); setSelectedProductIds([]); fetchInventoryData() } else { toast.error(error.message) }; setIsSubmitting(false) }
  
  const handleApplyBulkEdit = async (e: FormEvent) => { e.preventDefault(); setIsSubmitting(true); let finalValue: string | number = bulkEditValue; if (['stock_quantity', 'price_d2c', 'price_b2b', 'price_distributor', 'price_roti_factory', 'price_retail_modern', 'price_retail_old'].includes(bulkEditField)) finalValue = Number(bulkEditValue); const { error } = await supabase.from('products').update({ [bulkEditField]: finalValue }).in('id', selectedProductIds); if (!error) { toast.success(`Bulk updated!`); setShowBulkEditModal(false); setSelectedProductIds([]); fetchInventoryData() } else { toast.error(error.message) }; setIsSubmitting(false) }

  const handleExportInventory = () => { if (products.length === 0) return toast.error('No products to export'); const headers = ['id', 'name', 'description', 'category', 'unit', 'stock_quantity', 'price_d2c', 'price_b2b', 'price_distributor', 'price_roti_factory', 'price_retail_modern', 'price_retail_old']; const csvRows = products.map(p => headers.map(h => `"${String((p as any)[h] || '').replace(/"/g, '""')}"`).join(',')); const csvContent = [headers.join(','), ...csvRows].join('\n'); const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "rgdb_live_inventory.csv"; link.click() }
  const downloadCSVTemplate = () => { const headers = "name,description,category,unit,stock_quantity,price_d2c,price_b2b,price_distributor,price_roti_factory,price_retail_modern,price_retail_old\n"; const sample = "Premium Chakki Atta,Freshly milled 100% whole wheat,Wheat Flour,kg,500,50,45,42,40,48,49\n"; const blob = new Blob([headers + sample], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "template.csv"; link.click() }
  
  const handleUpdateInventoryCSV = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsSubmitting(true); toast('Updating Inventory...', { icon: '⏳' }); const reader = new FileReader(); reader.onload = async ({ target }) => { const text = target?.result as string; const lines = text.split('\n'); const headers = lines[0].split(',').map(h => h.trim().toLowerCase()); if (!headers.includes('id')) { toast.error('CSV must contain an "id" column for updates.'); setIsSubmitting(false); return; } const bulkData: any[] = []; for(let i=1; i<lines.length; i++) { if(!lines[i].trim()) continue; const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim()); const obj: Record<string, string | number> = {}; headers.forEach((h, idx) => { if (['stock_quantity', 'price_d2c', 'price_b2b', 'price_distributor', 'price_roti_factory', 'price_retail_modern', 'price_retail_old'].includes(h)) obj[h] = Number(values[idx] || 0); else obj[h] = values[idx] || ''; }); bulkData.push(obj) }; const { error } = await supabase.from('products').upsert(bulkData); if(!error) { toast.success(`Successfully updated ${bulkData.length} SKUs!`); fetchInventoryData(); } else { toast.error(error.message) }; setIsSubmitting(false) }; reader.readAsText(file); e.target.value = '' }
  
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsSubmitting(true); toast('Importing...'); const reader = new FileReader(); reader.onload = async ({ target }) => { const text = target?.result as string; const lines = text.split('\n'); const headers = lines[0].split(',').map(h => h.trim().toLowerCase()); const bulkData: any[] = []; for(let i=1; i<lines.length; i++) { if(!lines[i].trim()) continue; const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim()); const obj: Record<string, string | number> = {}; headers.forEach((h, idx) => { if (['stock_quantity', 'price_d2c', 'price_b2b', 'price_distributor', 'price_roti_factory', 'price_retail_modern', 'price_retail_old'].includes(h)) obj[h] = Number(values[idx] || 0); else obj[h] = values[idx] || ''; }); bulkData.push(obj) }; const { error } = await supabase.from('products').insert(bulkData); if(!error) { toast.success(`Imported ${bulkData.length} SKUs!`); fetchInventoryData(); setActiveView('inventory'); setAddMode('single') } else { toast.error(error.message) }; setIsSubmitting(false) }; reader.readAsText(file) }


  const navItems = [
    { id: 'inventory', icon: LayoutDashboard, label: 'Live Inventory' },
    { id: 'add', icon: PackagePlus, label: 'Add/Edit Catalog' },
    { id: 'profile', icon: UserCircle, label: 'My HR Profile' },
  ]

  if (isLoadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 size={48} className="animate-spin text-indigo-600" /></div>
  if (!isAuthorized) return <div className="min-h-screen flex items-center justify-center text-center p-12 font-bold text-slate-900"><AlertCircle size={64} className="mx-auto text-red-500 mb-4" />Inventory Access Required.</div>

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row w-full overflow-x-hidden text-slate-900 font-sans">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white h-16 flex items-center justify-between px-4 sticky top-0 z-30 shrink-0 shadow-md">
        <div className="font-bold text-lg flex items-center gap-2"><LayoutDashboard size={20}/> Warehouse Ops</div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-300"><Menu size={24} /></button>
      </div>

      {/* Sidebar Navigation */}
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
          <span className="text-white font-bold text-lg flex items-center gap-2"><ShieldCheck size={20} className="text-indigo-400"/> Inventory</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white"><X size={20}/></button>
        </div>
        <div className="p-6 border-b border-slate-800 bg-slate-800/30">
          <p className="text-white font-bold truncate">{manager?.full_name || 'Manager'}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">{manager?.employee_number || 'ID Pending'}</p>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveView(item.id as any); setIsMobileMenuOpen(false); setSelectedProductIds([]) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${activeView === item.id ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
              <item.icon size={20} className={activeView === item.id ? 'text-indigo-200' : 'text-slate-400'} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800"><button onClick={() => { supabase.auth.signOut(); window.location.replace('/auth'); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-rose-500/10 hover:text-rose-400 rounded-xl font-bold transition-colors"><LogOut size={20} /> Logout</button></div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-screen">
        <header className="mb-6 md:mb-8"><h2 className="text-2xl font-bold text-slate-900 tracking-tight">{navItems.find(n => n.id === activeView)?.label}</h2></header>

        {/* 1. LIVE INVENTORY TABLE */}
        {activeView === 'inventory' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col lg:flex-row gap-4 justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm items-center">
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 lg:w-64"><Search className="absolute left-3 top-2.5 text-slate-400" size={18}/><input type="text" placeholder="Search SKU or Category..." value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-full text-sm outline-none focus:border-indigo-500 text-slate-900 font-medium" /></div>
                <select value={inventoryCategory} onChange={e => setInventoryCategory(e.target.value)} className="bg-white border border-slate-300 text-slate-900 text-sm py-2 px-4 rounded-full font-bold shadow-sm outline-none">
                  {inventoryCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button onClick={handleExportInventory} className="bg-white text-slate-700 px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 border border-slate-200 hover:text-indigo-600 transition-colors"><Download size={14}/> Export</button>
                  <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 cursor-pointer transition-colors ml-1"><UploadCloud size={14}/> Sync Update CSV<input type="file" accept=".csv" onChange={handleUpdateInventoryCSV} className="hidden"/></label>
                </div>
                {selectedProductIds.length > 0 && (
                  <div className="flex items-center gap-3 bg-indigo-50 px-4 py-1.5 rounded-xl border-indigo-200 border shrink-0 animate-in zoom-in-95">
                    <span className="text-xs font-bold text-indigo-800">{selectedProductIds.length} Selected</span>
                    <button onClick={() => setShowBulkEditModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-[10px] font-bold transition-colors">Bulk Edit</button>
                    <button onClick={handleBulkDelete} className="text-rose-600 hover:bg-rose-100 p-1 rounded transition-colors"><Trash2 size={16}/></button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left whitespace-nowrap min-w-150">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-4 w-12"><button onClick={toggleAllSelections} className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedProductIds.length === filteredInventory.length && filteredInventory.length > 0 ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>{selectedProductIds.length === filteredInventory.length && filteredInventory.length > 0 && <Check size={12}/>}</button></th>
                      <th className="p-4">SKU Info</th>
                      <th className="p-4 text-center">Warehouse Stock</th>
                      <th className="p-4 text-center">Base Price (D2C)</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredInventory.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-medium">No products found.</td></tr> : filteredInventory.map(p => (
                      <tr key={p.id} className={`transition-colors ${selectedProductIds.includes(p.id) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                        <td className="p-4"><button onClick={() => toggleProductSelection(p.id)} className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedProductIds.includes(p.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>{selectedProductIds.includes(p.id) && <Check size={12}/>}</button></td>
                        <td className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shrink-0">{p.image_urls?.[0] ? <img src={p.image_urls[0]} className="w-full h-full object-cover" alt=""/> : <ImageIcon size={18} className="m-auto text-slate-400 h-full"/>}</div><div><div className="font-bold text-slate-900">{p.name}</div><div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{p.category}</div></div></div></td>
                        <td className="p-4 text-center font-mono"><span className={`font-bold px-3 py-1 rounded-lg ${p.stock_quantity < 50 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>{p.stock_quantity} {p.unit}</span></td>
                        <td className="p-4 text-center font-bold text-slate-700">₹{p.price_d2c}</td>
                        <td className="p-4 text-right"><div className="flex justify-end gap-1"><button onClick={() => handleEditClick(p)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={16}/></button><button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16}/></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. ADD / EDIT CATALOG ITEM */}
        {activeView === 'add' && (
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 max-w-4xl shadow-sm animate-in fade-in">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900"><PackagePlus className="text-indigo-600" /> {editId ? 'Edit Product SKU' : 'New Catalog Item'}</h3>
                <p className="text-sm text-slate-500 mt-1">Manage product details, pricing tiers, and images.</p>
              </div>
              {!editId && (
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button onClick={() => setAddMode('single')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${addMode === 'single' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>Single</button>
                  <button onClick={() => setAddMode('csv')} className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${addMode === 'csv' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}><FileSpreadsheet size={14}/> CSV Bulk</button>
                </div>
              )}
            </div>

            {addMode === 'single' ? (
              <form onSubmit={handleAddProduct} className="space-y-8">
                {/* Image Upload Area */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-3">Product Media</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {existingImageUrls.map((url, i) => (<div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 group shadow-sm"><img src={url} className="w-full h-full object-cover" alt=""/><button type="button" onClick={() => removeExistingImage(url)} className="absolute top-2 right-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-md"><X size={14}/></button></div>))}
                    {imagePreviews.map((src, i) => (<div key={i} className="relative aspect-square rounded-2xl border-2 border-indigo-200 overflow-hidden group shadow-sm"><img src={src} className="w-full h-full object-cover" alt=""/><button type="button" onClick={() => removeNewImage(i)} className="absolute top-2 right-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-md"><X size={14}/></button></div>))}
                    <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 cursor-pointer transition-colors bg-slate-50"><UploadCloud size={28} className="mb-2"/><span className="text-xs font-bold">Upload</span><input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden"/></label>
                  </div>
                </div>

                {/* Core Details */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-6">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">Core Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-1"><label className="text-xs font-bold text-slate-600 uppercase">Product Name</label><input required className="w-full p-3 bg-white border border-slate-300 text-slate-900 rounded-xl font-bold outline-none focus:border-indigo-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div><div className="space-y-1"><label className="text-xs font-bold text-slate-600 uppercase">Category</label><input required placeholder="e.g. Retail Flour" className="w-full p-3 bg-white border border-slate-300 text-slate-900 rounded-xl font-bold outline-none focus:border-indigo-500" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} /></div></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-600 uppercase">UOM (Unit)</label><select className="w-full p-3 bg-white border border-slate-300 text-slate-900 rounded-xl font-bold outline-none focus:border-indigo-500" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}><option value="kg">kg</option><option value="liter">liter</option><option value="packet">packet</option></select></div>
                    <div className="col-span-2 space-y-1"><label className="text-xs font-bold text-slate-600 uppercase">Current Stock Quantity</label><input required type="number" className="w-full p-3 bg-white border border-slate-300 text-slate-900 rounded-xl font-bold outline-none focus:border-indigo-500 font-mono" value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: e.target.value})} /></div>
                  </div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-600 uppercase">Description</label><textarea required rows={3} className="w-full p-3 bg-white border border-slate-300 text-slate-900 rounded-xl font-medium outline-none focus:border-indigo-500" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                </div>

                {/* Legacy Fallback Pricing */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">Legacy Static Pricing Tiers <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full">Fallback Mechanism</span></h4>
                    <p className="text-xs text-slate-500 mt-1">These static prices are used if the Dynamic Cost Engine (DPMIE) is not configured for this product.</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                    {['price_d2c', 'price_wholesale', 'price_distributor', 'price_roti_factory', 'price_retail_modern', 'price_retail_old'].map(f => (
                      <div key={f} className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{f.replace('price_', '').replace('_', ' ')}</label>
                        <span className="absolute left-3 top-7 text-slate-400 font-bold">₹</span>
                        <input required type="number" className="w-full pl-7 p-2.5 border border-slate-300 text-slate-900 bg-slate-50 rounded-lg font-bold outline-none focus:border-indigo-500 focus:bg-white transition-colors" value={(formData as any)[f]} onChange={e => setFormData({...formData, [f]: e.target.value})} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  {editId && <button type="button" onClick={() => {setEditId(null); setActiveView('inventory')}} className="px-8 py-4 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel Edit</button>}
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95">
                    {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} {editId ? 'Update Catalog Item' : 'Save to Catalog'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-8 text-center py-12">
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-left"><h4 className="font-bold text-indigo-900 mb-1">CSV Bulk Initialization</h4><p className="text-sm text-indigo-800">Populate a massive catalog instantly via Excel.</p></div>
                  <button onClick={downloadCSVTemplate} className="bg-white text-indigo-700 px-6 py-3 rounded-xl font-bold shadow-sm flex items-center gap-2 border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-colors"><Download size={18}/> Download CSV Template</button>
                </div>
                <label className="block w-full border-2 border-dashed border-slate-300 rounded-3xl p-16 hover:bg-slate-50 hover:border-indigo-400 cursor-pointer transition-all group">
                  <UploadCloud size={48} className="mx-auto text-slate-400 group-hover:text-indigo-500 mb-4 transition-colors"/>
                  <p className="font-bold text-slate-700 text-lg">Click to browse or drag CSV file here</p>
                  <p className="text-sm text-slate-500 mt-2">Maximum 5,000 SKUs per upload</p>
                  <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden"/>
                </label>
              </div>
            )}
          </div>
        )}

        {/* 3. MY HR PROFILE */}
        {activeView === 'profile' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-2xl animate-in fade-in">
            <h3 className="text-xl font-bold mb-6 text-slate-900 flex items-center gap-2"><UserCircle className="text-indigo-600"/> Inventory Manager Profile</h3>
            <form onSubmit={handleUpdateHR} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase">Employee Number</label><input required type="text" value={hrForm.employee_number} onChange={e => setHrForm({...hrForm, employee_number: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-indigo-500 uppercase" placeholder="e.g. RG-INV-01"/></div>
                <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase">ID Proof (Aadhaar/PAN)</label><input required type="text" value={hrForm.id_proof_number} onChange={e => setHrForm({...hrForm, id_proof_number: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-indigo-500 uppercase" placeholder="ID Number"/></div>
              </div>
              <div><label className="block text-xs font-bold mb-2 text-slate-700 uppercase">Emergency Contact</label><input required type="text" value={hrForm.emergency_contact} onChange={e => setHrForm({...hrForm, emergency_contact: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-indigo-500" placeholder="Name - Phone Number"/></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 size={20} className="animate-spin"/> : 'Save Profile Details'}</button>
            </form>
          </div>
        )}

      </main>

      {/* --- BULK EDIT MODAL --- */}
      {showBulkEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowBulkEditModal(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Bulk Edit Catalog</h3>
            <p className="text-sm text-slate-600 mb-6">Updating <strong className="text-indigo-600">{selectedProductIds.length}</strong> items simultaneously.</p>
            <form onSubmit={handleApplyBulkEdit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold mb-2 text-slate-700 uppercase">Field to Modify</label>
                <select value={bulkEditField} onChange={(e) => setBulkEditField(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold">
                  <option value="category">Category</option>
                  <option value="stock_quantity">Warehouse Stock Quantity</option>
                  <option value="price_d2c">D2C Retail Price</option>
                  <option value="price_b2b">B2B Base Price</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-2 text-slate-700 uppercase">New Value</label>
                <input required type={['category'].includes(bulkEditField) ? "text" : "number"} className="w-full p-3 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" value={bulkEditValue} onChange={(e) => setBulkEditValue(e.target.value)} />
              </div>
              <div className="flex gap-3 justify-end pt-4 mt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowBulkEditModal(false)} className="px-5 py-3 font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-transform active:scale-95 flex items-center gap-2">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>} Apply to All
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}