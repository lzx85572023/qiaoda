// 巧答 · 基础 UI 组件库（自研，克制统一）

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react'
import { Check, X } from 'lucide-react'

/* ---------- 按钮 ---------- */
type BtnVariant = 'primary' | 'soft' | 'ghost' | 'danger'

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'ghost',
  size = 'md',
  block,
  loading,
  icon,
  className = '',
  children,
  disabled,
  ...rest
}: BtnProps): React.JSX.Element {
  return (
    <button
      className={`btn ${variant} ${size} ${block ? 'block' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="spinner" /> : icon}
      {children}
    </button>
  )
}

interface IconBtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  active?: boolean
  title?: string
}

export function IconBtn({ icon, active, title, className = '', ...rest }: IconBtnProps): React.JSX.Element {
  return (
    <button className={`icon-btn ${active ? 'active' : ''} ${className}`} title={title} {...rest}>
      {icon}
    </button>
  )
}

/* ---------- 表单 ---------- */
export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return <input className={`input ${className}`} {...rest} />
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
  return <textarea className={`textarea ${className}`} {...rest} />
}

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[]
}

export function Select({ options, className = '', ...rest }: SelectProps): React.JSX.Element {
  return (
    <select className={`select ${className}`} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Field({
  label,
  desc,
  children,
  right
}: {
  label: string
  desc?: string
  right?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="field">
      <div className="field-label">
        <span>{label}</span>
        {right}
      </div>
      {children}
      {desc && <div className="field-hint">{desc}</div>}
    </div>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  desc?: string
}

export function Toggle({ checked, onChange, label, desc }: ToggleProps): React.JSX.Element {
  return (
    <div className="toggle-row">
      <div>
        {label && <div className="toggle-label">{label}</div>}
        {desc && <div className="toggle-desc">{desc}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`toggle ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}

export function Chip({
  active,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }): React.JSX.Element {
  return (
    <button type="button" className={`chip ${active ? 'active' : ''} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function Badge({
  tone = 'plain',
  children
}: {
  tone?: 'accent' | 'warn' | 'danger' | 'plain'
  children: ReactNode
}): React.JSX.Element {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function Kbd({ children }: { children: ReactNode }): React.JSX.Element {
  return <span className="kbd">{children}</span>
}

/* ---------- 卡片 ---------- */
export function Card({
  title,
  desc,
  actions,
  children,
  pad = true,
  className = '',
  style
}: {
  title?: string
  desc?: string
  actions?: ReactNode
  children: ReactNode
  pad?: boolean
  className?: string
  style?: CSSProperties
}): React.JSX.Element {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <div className="card-title">{title}</div>}
            {desc && <div className="card-desc">{desc}</div>}
          </div>
          {actions}
        </div>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  )
}

/* ---------- 弹窗 ---------- */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 460
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="modal-mask"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal" style={{ width }}>
        <div className="modal-head">
          <span>{title}</span>
          <IconBtn icon={<X size={15} />} onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------- 确认对话框 ---------- */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  danger = false,
  onConfirm,
  onClose
}: {
  open: boolean
  title: string
  message: string
  confirmText?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}): React.JSX.Element | null {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width={400}
      footer={
        <>
          <Button size="md" onClick={onClose}>
            取消
          </Button>
          <Button
            size="md"
            variant={danger ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.7 }}>{message}</div>
    </Modal>
  )
}

/* ---------- 空状态 ---------- */
export function Empty({
  icon,
  title,
  desc,
  action
}: {
  icon: ReactNode
  title: string
  desc?: string
  action?: ReactNode
}): React.JSX.Element {
  return (
    <div className="empty">
      <div className="icon">{icon}</div>
      <div className="title">{title}</div>
      {desc && <div className="desc">{desc}</div>}
      {action && <div className="action">{action}</div>}
    </div>
  )
}

/* ---------- Toast ---------- */
interface ToastItem {
  id: number
  type: 'info' | 'success' | 'error'
  message: string
}

const ToastContext = createContext<(message: string, type?: 'info' | 'success' | 'error') => void>(
  () => undefined
)

export function useToast(): (message: string, type?: 'info' | 'success' | 'error') => void {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const show = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = ++idRef.current
    setToasts((list) => [...list, { id, type, message }])
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id))
    }, 2600)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' && <Check size={14} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/* ---------- 保存状态指示 ---------- */
export function SaveState({ state }: { state: 'idle' | 'saving' | 'saved' }): React.JSX.Element {
  if (state === 'idle') return <span style={{ color: 'var(--ink-3)' }} />
  if (state === 'saving') return <span style={{ color: 'var(--ink-3)' }}>保存中…</span>
  return (
    <span style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Check size={13} /> 已保存
    </span>
  )
}
