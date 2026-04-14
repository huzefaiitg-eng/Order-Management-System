import { useState, useRef } from 'react';
import { Upload, X, Loader2, GripVertical } from 'lucide-react';
import { uploadImage } from '../services/api';

export default function ImageUpload({ images = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [draggingIdx, setDraggingIdx] = useState(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const urls = [];
      for (const file of Array.from(files)) {
        const url = await uploadImage(file);
        urls.push(url);
      }
      onChange([...images, ...urls]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeImage = (index) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onDragStart = (index) => {
    dragItem.current = index;
    setDraggingIdx(index);
  };

  const onDragEnter = (index) => {
    dragOverItem.current = index;
  };

  const onDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      setDraggingIdx(null);
      return;
    }
    const reordered = [...images];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, removed);
    onChange(reordered);
    dragItem.current = null;
    dragOverItem.current = null;
    setDraggingIdx(null);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Product Images</label>

      {/* Preview thumbnails — draggable */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div
              key={url + i}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragEnter={() => onDragEnter(i)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`relative w-16 h-16 rounded-lg overflow-hidden border group select-none transition-all ${
                draggingIdx === i ? 'border-terracotta-400 opacity-50 scale-95' : 'border-gray-200'
              }`}
            >
              <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
              {/* Drag handle overlay */}
              <div className="absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-black/30 to-transparent flex items-start justify-center pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                <GripVertical size={10} className="text-white" />
              </div>
              {/* Remove button */}
              <button type="button" onClick={() => removeImage(i)}
                className="absolute top-0 right-0 w-5 h-5 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-md">
                <X size={10} className="text-white" />
              </button>
              {/* Position indicator */}
              {i === 0 && images.length > 1 && (
                <span className="absolute bottom-0 left-0 text-[9px] bg-terracotta-600 text-white px-1 rounded-tr-md leading-tight">1st</span>
              )}
            </div>
          ))}
        </div>
      )}
      {images.length > 1 && (
        <p className="text-[11px] text-gray-400">Drag to reorder. First image is the cover.</p>
      )}

      {/* Upload area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          uploading ? 'border-gray-200 bg-gray-50 cursor-wait' : 'border-gray-300 hover:border-terracotta-400 hover:bg-terracotta-50/30'
        }`}
      >
        {uploading ? (
          <>
            <Loader2 size={16} className="text-terracotta-500 animate-spin" />
            <span className="text-sm text-gray-500">Uploading...</span>
          </>
        ) : (
          <>
            <Upload size={16} className="text-gray-400" />
            <span className="text-sm text-gray-500">Click or drag images</span>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
