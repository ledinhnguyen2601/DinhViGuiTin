import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * SmartInput - Component tối ưu nhập liệu tiếng Việt (Telex / VNI) trên Android & iOS
 * Sử dụng cơ chế native input buffer, hoàn toàn tương thích với Gboard, Laban Key, bàn phím Android:
 * - Gõ tiếng Việt có dấu tức thì không cần bấm phím Cách (Space)
 * - Tự do xóa bằng Backspace, sửa ký tự, bôi đen mà không bị kẹt hay giật con trỏ
 * - Đồng bộ thời gian thực về parent state
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
  const inputRef = useRef(null);
  const [hasContent, setHasContent] = useState(Boolean(value));

  // Đồng bộ giá trị từ bên ngoài (khi load cấu hình, chọn điểm ghim, hoặc reset)
  useEffect(() => {
    if (inputRef.current) {
      const current = inputRef.current.value;
      const target = value ?? '';
      // Cập nhật khi giá trị khác biệt và (người dùng không đang chủ động gõ hoặc giá trị bị reset về rỗng)
      if (current !== target) {
        if (document.activeElement !== inputRef.current || target === '') {
          inputRef.current.value = target;
          setHasContent(Boolean(target));
        }
      }
    }
  }, [value]);

  const handleInput = (e) => {
    const val = e.target.value;
    setHasContent(Boolean(val));
    // Phát ngay lập tức lên parent để nhận diện tức thì, không chặn IME
    onChange(val);
  };

  const handleBlur = (e) => {
    if (inputRef.current) {
      onChange(inputRef.current.value);
    }
    if (typeof onBlur === 'function') {
      onBlur(e);
    }
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
    setHasContent(false);
    onChange('');
  };

  return (
    <div className="relative w-full flex items-center">
      <input
        ref={inputRef}
        type={type}
        inputMode={inputMode}
        defaultValue={value ?? ''}
        onInput={handleInput}
        onChange={handleInput}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={`w-full ${allowClear && hasContent ? 'pr-9' : ''} ${className}`}
      />
      {allowClear && hasContent && !disabled && (
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

