'use client'

import Link from 'next/link'
import { ChevronLeft, FileText, Banknote, ShieldAlert, Scale, CheckCircle2 } from 'lucide-react'

export default function PoliciesPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <nav className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2 font-bold hover:text-indigo-300 transition-colors">
            <ChevronLeft size={20}/> Back to Store
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Scale className="text-indigo-600" size={36} /> Legal & Policies
          </h1>
          <p className="text-slate-500 mt-3 text-lg">Please read these terms carefully before placing an order. By using the Raj Gharona platform, you agree to these conditions.</p>
        </div>

        <div className="space-y-8">
          
          {/* Section 1: General Terms */}
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center shrink-0">
                <FileText size={24} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">General Terms</h2>
            </div>
            <ul className="space-y-4">
              {['Minimum order quantities apply for B2B wholesale pricing.', 'All prices are exclusive of GST unless explicitly stated.', 'Prices are subject to market fluctuation without prior notice.'].map((text, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-indigo-600 shrink-0 mt-0.5" />
                  <span className="text-slate-700 leading-relaxed font-medium">{text}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Section 2: Payment Terms */}
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                <Banknote size={24} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Payment Terms</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                '100% Advance Payment is preferred for fastest processing.',
                'Alternative: 10% Advance, 90% payment strictly before dispatch.',
                'Cash on Delivery (COD) is available only for D2C retail orders.',
                'App Wallet / Ledger Balance must be pre-loaded via UTR submission.',
                'Credit Limits are strictly monitored; ordering halts if limits are exceeded.',
                'Overdue invoices attract an interest penalty as per standard terms.'
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0"></div>
                  <span className="text-slate-700 font-medium text-sm leading-relaxed">{text}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Damages and Replacement */}
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-rose-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-full -mr-8 -mt-8 opacity-50"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6 border-b border-rose-100 pb-4">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldAlert size={24} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Damages & Replacement Policy</h2>
              </div>
              
              <div className="space-y-5">
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0">1</div>
                  <p className="text-slate-700 font-medium pt-1"><strong className="text-slate-900">Inspection:</strong> Customers must inspect all goods immediately upon delivery.</p>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0">2</div>
                  <p className="text-slate-700 font-medium pt-1"><strong className="text-slate-900">Reporting Window:</strong> Any damages, shortages, or discrepancies must be reported within <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">24 hours</span> of receipt.</p>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0">3</div>
                  <p className="text-slate-700 font-medium pt-1"><strong className="text-slate-900">Evidence Required:</strong> Clear photographic and video evidence (including an unboxing video) is mandatory for all claims.</p>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0">4</div>
                  <p className="text-slate-700 font-medium pt-1"><strong className="text-slate-900">Resolution:</strong> Replacements or wallet refunds will be issued only for verified damaged goods.</p>
                </div>
                
                <div className="mt-6 bg-rose-50 border border-rose-200 p-5 rounded-xl flex gap-4 items-start">
                  <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
                  <p className="text-rose-900 text-sm font-bold leading-relaxed">
                    STRICT NON-RETURNABLE CLAUSE:<br/>
                    <span className="font-medium text-rose-800">Opened, partially used, or tampered bags/packets cannot be returned or replaced under any circumstances due to strict FSSAI food safety guidelines.</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

        </div>
        
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>Last Updated: {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
        </div>
      </main>
    </div>
  )
}