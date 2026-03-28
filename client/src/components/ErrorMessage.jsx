import { AlertTriangle } from 'lucide-react';

export default function ErrorMessage({ message }) {
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mx-6 my-4">
      <AlertTriangle size={20} />
      <p className="text-sm">{message}</p>
    </div>
  );
}
