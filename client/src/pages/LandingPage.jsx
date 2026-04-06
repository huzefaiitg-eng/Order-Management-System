import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingBag, BarChart3, Package, Users, Lightbulb, TableProperties,
  ChevronDown, X, CheckCircle, Send, ArrowRight, Menu
} from 'lucide-react';
import logo from '../assets/logo.png';
import heroImg from '../assets/hero.png';

/* ─── Demo Request Modal ─── */
function DemoRequestModal({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setStatus('sending');
    setErrorMsg('');
    try {
      const key = import.meta.env.VITE_WEB3FORMS_KEY;
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: key,
          subject: `Demo Request from ${form.name}`,
          from_name: form.name,
          name: form.name,
          email: form.email,
          phone: form.phone || 'Not provided',
          company: form.company || 'Not provided',
          message: form.message || 'No message',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
      } else {
        throw new Error(data.message || 'Submission failed');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {status === 'success' ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Thank you!</h3>
            <p className="text-sm text-gray-600">We've received your request and will be in touch shortly.</p>
            <button onClick={onClose} className="px-6 py-2.5 bg-terracotta-600 text-white rounded-lg text-sm font-medium hover:bg-terracotta-700 transition-colors">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Request a Demo</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {status === 'error' && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errorMsg}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Your full name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="you@company.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Phone number" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500" placeholder="Company name" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 resize-none" placeholder="Tell us about your business needs..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={status === 'sending'}
                  className="flex-1 px-4 py-2.5 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50 font-medium flex items-center justify-center gap-2 transition-colors">
                  {status === 'sending' ? 'Sending...' : <><Send size={14} /> Send Request</>}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── FAQ Item ─── */
function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors">
        <span className="text-sm font-medium text-gray-900 pr-4">{question}</span>
        <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">{answer}</div>
      )}
    </div>
  );
}

/* ─── Feature Card ─── */
function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="w-11 h-11 rounded-lg bg-terracotta-50 text-terracotta-600 flex items-center justify-center mb-4">
        <Icon size={22} />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

/* ─── Browser Mockup ─── */
function BrowserMockup({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden ${className}`}>
      {/* Title bar */}
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 ml-3">
          <div className="bg-white rounded-md px-3 py-1 text-xs text-gray-400 max-w-xs">kleithronix.com/dashboard</div>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ─── Main Landing Page ─── */
export default function LandingPage() {
  const { user } = useAuth();
  const [showDemo, setShowDemo] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    { icon: ShoppingBag, title: 'Multi-Channel Orders', description: 'Manage Amazon, Flipkart, Meesho, Instagram, and WhatsApp orders from a single dashboard.' },
    { icon: BarChart3, title: 'Smart Dashboard', description: 'Real-time KPIs, revenue trends, profit analytics, and order status breakdowns at a glance.' },
    { icon: Package, title: 'Inventory Tracking', description: 'Monitor stock levels, get low-stock alerts, and manage products with auto-generated article IDs.' },
    { icon: Users, title: 'Customer Management', description: 'Customer profiles, order history, active order tracking, and repeat customer insights.' },
    { icon: Lightbulb, title: 'Actionable Insights', description: 'Delayed order alerts, COD follow-ups, churn risk detection, and low-margin warnings.' },
    { icon: TableProperties, title: 'Google Sheets Powered', description: 'Uses your existing Google Sheet as the database. No migration, no new tools to learn.' },
  ];

  const faqs = [
    { question: 'How does the Google Sheets integration work?', answer: 'Your order data stays in Google Sheets. Our app connects via a secure service account, reads and writes data in real-time. You keep full control and visibility of your data in Sheets while getting a powerful management interface on top.' },
    { question: 'Can I manage multiple sales channels?', answer: 'Yes! The system supports Amazon, Flipkart, Meesho, Instagram, WhatsApp, and manual orders. Each order is tagged with its source, and you can filter and analyze performance by channel.' },
    { question: 'Is my data secure?', answer: 'Your Google Sheet is accessed via a service account with read/write permissions only to your specific spreadsheet. Authentication uses JWT tokens, and all API communication is encrypted over HTTPS.' },
    { question: 'How do I get started?', answer: 'Request a demo and we\'ll set up your Google Sheet with the required structure, configure the service account access, and get you up and running within 24 hours.' },
    { question: 'What does the demo include?', answer: 'You\'ll get a full walkthrough of the dashboard, order management, inventory tracking, and customer insights. We\'ll also show you how data flows between the app and your Google Sheet in real-time.' },
  ];

  return (
    <div className="min-h-screen bg-white" style={{ scrollBehavior: 'smooth' }}>
      {/* ─── Header ─── */}
      <header className="bg-brand-black sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/">
            <img src={logo} alt="Klethronix" className="h-7 sm:h-8" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-300 hover:text-white transition-colors">Features</a>
            <a href="#faq" className="text-sm text-gray-300 hover:text-white transition-colors">FAQ</a>
            {user ? (
              <Link to="/dashboard" className="px-4 py-2 text-sm font-medium bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors">
                Dashboard
              </Link>
            ) : (
              <Link to="/login" className="px-4 py-2 text-sm font-medium bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors">
                Login
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="sm:hidden text-gray-300 hover:text-white">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-800 px-4 py-3 space-y-2">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-white/10">Features</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-white/10">FAQ</a>
            {user ? (
              <Link to="/dashboard" className="block px-3 py-2 text-sm font-medium text-terracotta-500">Dashboard</Link>
            ) : (
              <Link to="/login" className="block px-3 py-2 text-sm font-medium text-terracotta-500">Login</Link>
            )}
          </div>
        )}
      </header>

      {/* ─── Hero ─── */}
      <section className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div className="space-y-6">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
              Manage Orders.<br />
              <span className="text-terracotta-600">Delight Customers.</span>
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed max-w-lg">
              A powerful order management system that connects to your Google Sheet. Track orders from Amazon, Flipkart, Meesho, Instagram, and WhatsApp — all in one place.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setShowDemo(true)}
                className="px-6 py-3 bg-terracotta-600 text-white rounded-lg text-sm font-medium hover:bg-terracotta-700 transition-colors flex items-center gap-2 shadow-sm">
                Request a Demo <ArrowRight size={16} />
              </button>
              <Link to="/login"
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
                Login
              </Link>
            </div>
          </div>
          {/* Right — Browser mockup */}
          <div className="lg:block">
            <BrowserMockup>
              <img src={heroImg} alt="Dashboard preview" className="w-full" />
            </BrowserMockup>
          </div>
        </div>
      </section>

      {/* ─── Dashboard Showcase ─── */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center space-y-10">
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Your Dashboard at a Glance</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Get real-time visibility into orders, revenue, inventory, and customer metrics — all from a single screen.</p>
          </div>
          <BrowserMockup className="text-left">
            <img src={heroImg} alt="Full dashboard view" className="w-full" />
          </BrowserMockup>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Everything You Need</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">From order tracking to inventory alerts, we've got your operations covered.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Frequently Asked Questions</h2>
            <p className="text-gray-600">Got questions? We've got answers.</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FAQItem key={faq.question} {...faq} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="bg-terracotta-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Ready to Streamline Your Orders?</h2>
          <p className="text-terracotta-100 text-lg max-w-xl mx-auto">Get started in minutes. Your Google Sheet, supercharged with a powerful management layer.</p>
          <button onClick={() => setShowDemo(true)}
            className="px-8 py-3.5 bg-white text-terracotta-700 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors shadow-sm inline-flex items-center gap-2">
            Request a Demo <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-brand-black border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Klethronix" className="h-6" />
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="#features" className="text-gray-400 hover:text-gray-200 transition-colors">Features</a>
              <a href="#faq" className="text-gray-400 hover:text-gray-200 transition-colors">FAQ</a>
              <Link to="/login" className="text-gray-400 hover:text-gray-200 transition-colors">Login</Link>
              <a href="mailto:huzefa.iitg@gmail.com" className="text-gray-400 hover:text-gray-200 transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-800 text-center">
            <p className="text-xs text-gray-500">Built by Klethronix Solutions</p>
          </div>
        </div>
      </footer>

      {/* ─── Demo Modal ─── */}
      {showDemo && <DemoRequestModal onClose={() => setShowDemo(false)} />}
    </div>
  );
}
