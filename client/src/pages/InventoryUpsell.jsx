import { Link } from 'react-router-dom';
import {
  Package, Bell, Star, BarChart3, FileText, Tag, Mail, ArrowLeft,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Package,
    title: 'Real-time stock levels',
    body: 'See exactly how many units of every product are on hand and how many are committed to active orders.',
  },
  {
    icon: Star,
    title: 'Best-seller insights',
    body: 'Top products ranked by orders and revenue, plus high-return alerts so you know what to push and what to fix.',
  },
  {
    icon: Bell,
    title: 'Low / out-of-stock alerts',
    body: 'Auto-flagged when a product drops below your threshold or hits zero — so you never lose a sale.',
  },
  {
    icon: BarChart3,
    title: 'Inventory KPIs',
    body: 'Total products, total inventory value, low-stock count, and out-of-stock count — all on the Inventory Insights tab.',
  },
  {
    icon: FileText,
    title: 'Stock audit trail',
    body: 'Every change is logged: who placed which order, when stock was decremented, restored, or manually adjusted.',
  },
  {
    icon: Tag,
    title: 'Categories & sub-categories',
    body: 'Multi-select category filters, per-category breakdowns, and sub-category insights for richer reporting.',
  },
];

const ADMIN_EMAIL = 'huzefa.iitg@gmail.com';

export default function InventoryUpsell() {
  return (
    <div className="p-4 sm:p-6 lg:p-10">
      {/* Hero */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-10">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-terracotta-50 text-terracotta-600 flex items-center justify-center shrink-0">
            <Package size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold tracking-widest uppercase text-terracotta-600 mb-1">
              Add-on module
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
              Inventory Management
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-2xl leading-relaxed">
              Built for retailers who keep stock on hand. Know exactly what&apos;s selling,
              what&apos;s running low, and what&apos;s sitting on the shelf — all in one place.
              If you only resell or drop-ship items, you may not need this — but if you carry
              your own inventory, this module saves hours every week.
            </p>
          </div>
        </div>
      </div>

      {/* Feature grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="w-10 h-10 rounded-lg bg-terracotta-50 text-terracotta-600 flex items-center justify-center mb-3">
              <Icon size={18} />
            </div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-6 bg-gradient-to-br from-terracotta-50 to-white rounded-2xl border border-terracotta-100 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Want access to the Inventory module?</h3>
            <p className="mt-1.5 text-sm text-gray-600">
              Drop the admin an email and we&apos;ll turn it on for your account.
            </p>
          </div>
          <a
            href={`mailto:${ADMIN_EMAIL}?subject=Request%20access%20to%20Inventory%20module`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-terracotta-600 text-white text-sm font-semibold rounded-lg hover:bg-terracotta-700 transition-colors shadow-sm"
          >
            <Mail size={16} />
            Email {ADMIN_EMAIL}
          </a>
        </div>
      </div>

      {/* Back link */}
      <div className="mt-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Sales Dashboard
        </Link>
      </div>
    </div>
  );
}
