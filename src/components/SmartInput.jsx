import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * SmartInput - Component tối ưu nhập liệu tiếng Việt (Telex / VNI) trên Android & iOS
 * Khắc phục triệt để lỗi mất dấu, kẹt chữ, phải ấn Space mới hiện chữ, hoặc không xóa được bằng Backspace
 */
export function SmartInput({
  value = '',
  onChange = () => {},
  onBlur,
  placeholder = '',
  className = '',
  type = 'text',
  inputMode = 'text',
  maxLength,
  disabled = false,
  allowClear = true,
  autoFocus = false,
}) {
  const [localValue, setLocalValue] = useState(value ?? '');
  const isComposingRef = useRef(false);
  const inputRef = useRef(null);

  // Synchronize from parent only when NOT currently composing in IME
  useEffect(() => {
    if (!isComposingRef.current && value !== localValue) {
      setLocalValue(value ?? '');
    }
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalValue(val);
    // If not composing (or finished word), sync up to parent
    if (!isComposingRef.current) {
      onChange(val);
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e) => {
    isComposingRef.current = false;
    const val = e.target.value;
    setLocalValue(val);
    onChange(val);
  };

  const handleBlur = (e) => {
    isComposingRef.current = false;
    onChange(localValue);
    if (typeof onBlur === 'function') {
      onBlur(e);
    }
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLocalValue('');
    onChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="relative w-full flex items-center">
      <input
        ref={inputRef}
        type={type}
        inputMode={inputMode}
        value={localValue}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        className={`w-full ${allowClear && localValue ? 'pr-9' : ''} ${className}`}
      />
      {allowClear && localValue && !disabled && (
        <button
          type="button"
          tabIndex={-1}
          onClick={handleClear}
          className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
          title="Xóa trắng"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
