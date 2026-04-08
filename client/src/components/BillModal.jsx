import { useRef, useMemo } from 'react';
import { X, Download, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BillModal({ order, onClose }) {
  const { user } = useAuth();
  const invoiceRef = useRef(null);

  const orderNumber = order.orderNumber || useMemo(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return 'INV-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }, []);

  const productLines = order.productLines?.length > 0
    ? order.productLines
    : [{ productName: order.productOrdered, unitCost: order.productCost, quantity: order.quantityOrdered, lineTotal: order.productCost * order.quantityOrdered }];

  const totalAmount = order.pricePaid || 0;

  const handleDownload = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = invoiceRef.current;
    html2pdf().set({
      margin: 0.4,
      filename: `${orderNumber}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    }).from(element).save();
  };

  const handleShare = async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = invoiceRef.current;
      const blob = await html2pdf().set({
        margin: 0.4,
        filename: `${orderNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      }).from(element).outputPdf('blob');
      const file = new File([blob], `${orderNumber}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${orderNumber}` });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl z-10">
          <h2 className="text-lg font-bold text-gray-900">Invoice</h2>
          <div className="flex items-center gap-2">
            {canShare && (
              <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                <Share2 size={14} /> Share
              </button>
            )}
            <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700">
              <Download size={14} /> Download PDF
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-1"><X size={20} /></button>
          </div>
        </div>

        {/* Invoice content — uses inline styles for PDF capture */}
        <div ref={invoiceRef} style={{ padding: '32px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1a1a1a', fontSize: '14px', lineHeight: '1.5' }}>
          {/* Company header */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 4px 0', color: '#1a1a1a' }}>{user?.companyName || 'Company Name'}</h1>
            {user?.address && <p style={{ margin: '2px 0', color: '#666', fontSize: '13px' }}>{user.address}</p>}
            <div style={{ color: '#666', fontSize: '13px' }}>
              {user?.email && <span>{user.email}</span>}
              {user?.email && user?.phone && <span style={{ margin: '0 8px' }}>|</span>}
              {user?.phone && <span>{user.phone}</span>}
            </div>
            {user?.website && <p style={{ margin: '2px 0', color: '#666', fontSize: '13px' }}>{user.website}</p>}
          </div>

          <hr style={{ border: 'none', borderTop: '2px solid #C8956C', marginBottom: '24px' }} />

          {/* Invoice title + details */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px 0', color: '#C8956C', letterSpacing: '1px' }}>INVOICE</h2>
              <p style={{ margin: '2px 0', fontSize: '13px', color: '#666' }}>Invoice No: <strong style={{ color: '#1a1a1a' }}>{orderNumber}</strong></p>
              <p style={{ margin: '2px 0', fontSize: '13px', color: '#666' }}>Date: <strong style={{ color: '#1a1a1a' }}>{order.orderDate}</strong></p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#666' }}>Bill To:</p>
              <p style={{ margin: '2px 0', fontWeight: '600', fontSize: '15px' }}>{order.customerName}</p>
              {order.customerPhone && <p style={{ margin: '2px 0', color: '#666', fontSize: '13px' }}>{order.customerPhone}</p>}
              {order.customerAddress && <p style={{ margin: '2px 0', color: '#666', fontSize: '13px', maxWidth: '200px' }}>{order.customerAddress}</p>}
            </div>
          </div>

          {/* Products table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9f5f2' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #C8956C', fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #C8956C', fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>Product</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #C8956C', fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>Qty</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #C8956C', fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>Unit Price</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #C8956C', fontSize: '12px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {productLines.map((line, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 12px', color: '#666' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontWeight: '500' }}>{line.productName}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{line.quantity}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>₹{(line.unitCost || 0).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500' }}>₹{(line.lineTotal || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="4" style={{ padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '15px', borderTop: '2px solid #C8956C' }}>Total</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '15px', borderTop: '2px solid #C8956C', color: '#C8956C' }}>₹{totalAmount.toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>

          {/* Payment method */}
          <div style={{ marginBottom: '32px', padding: '12px 16px', backgroundColor: '#f9f9f9', borderRadius: '8px', fontSize: '13px' }}>
            <span style={{ color: '#666' }}>Payment Method: </span>
            <strong>{order.modeOfPayment}</strong>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', paddingTop: '16px', borderTop: '1px solid #eee', color: '#999', fontSize: '13px' }}>
            Thank you for your business!
          </div>
        </div>
      </div>
    </div>
  );
}
