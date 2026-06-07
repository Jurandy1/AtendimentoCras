import React, { useEffect } from 'react';
import Button from './Button';
import { AlertTriangle, Info, HelpCircle } from 'lucide-react';

const ConfirmDialog = ({ 
  isOpen, 
  title = "Confirmação", 
  message, 
  confirmText = "Confirmar", 
  cancelText = "Cancelar", 
  onConfirm, 
  onCancel,
  type = "warning" // warning, info, danger
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch(type) {
      case 'danger': return <AlertTriangle className="text-red-500" size={32} />;
      case 'info': return <Info className="text-blue-500" size={32} />;
      case 'warning':
      default: return <HelpCircle className="text-amber-500" size={32} />;
    }
  };

  const getConfirmVariant = () => {
    switch(type) {
      case 'danger': return 'danger';
      case 'info': return 'primary';
      case 'warning':
      default: return 'warning';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className={`p-3 rounded-full ${
            type === 'danger' ? 'bg-red-50' : 
            type === 'info' ? 'bg-blue-50' : 'bg-amber-50'
          }`}>
            {getIcon()}
          </div>
          
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          
          <p className="text-slate-600 text-sm whitespace-pre-wrap">
            {message}
          </p>
        </div>
        
        <div className="bg-slate-50 p-4 flex gap-3 justify-end border-t border-slate-100">
          <Button variant="secondary" onClick={onCancel} className="flex-1 sm:flex-none">
            {cancelText}
          </Button>
          <Button variant={getConfirmVariant()} onClick={onConfirm} className="flex-1 sm:flex-none">
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
