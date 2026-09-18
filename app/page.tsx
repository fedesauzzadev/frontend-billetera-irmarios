'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, ChevronRight, Clock3, Copy, Home, LogOut, Menu, Plus, Send, Wallet, X } from 'lucide-react'

type Account = { alias: string; id: string; name: string; initials: string; color: string }
type Balance = { account_id: string; balance: string | number; currency: string; as_of: string }
type Transaction = { id?: string; transaction_id?: string; amount: string | number; currency?: string; memo?: string; description?: string; created_at?: string; occurred_at?: string; type?: string; direction?: string; counterparty_alias?: string; dest_alias?: string }
type ApiError = { status: number; message: string }

const accounts: Account[] = [
  { alias: 'irma.mp', id: 'c7dcd83a-c59c-4ae1-9868-3cd565d2b278', name: 'Irma', initials: 'IR', color: '#8b5cf6' },
  { alias: 'juan.mp', id: 'd9b07b52-096f-417d-93df-b98b27e33511', name: 'Juan', initials: 'JU', color: '#20c4d9' },
]
const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const cache = response.headers.get('X-Cache')
  const stale = response.headers.get('X-Stale')
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw { status: response.status, message: body.message || body.error || 'No pudimos completar la operación.' } as ApiError
  return { body, cache, stale }
}

function formatMoney(value: string | number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value))
}
function formatDate(date?: string) { return date ? new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date)) : 'Hoy' }
function transactionLabel(t: Transaction) { return t.memo || t.description || t.counterparty_alias || t.dest_alias || 'Movimiento' }
function isIncome(t: Transaction) { return t.direction === 'credit' || t.direction === 'in' || t.type === 'credit' || Number(t.amount) < 0 }

export default function Page() {
  const [account, setAccount] = useState<Account | null>(null)
  const [screen, setScreen] = useState<'home' | 'send' | 'history'>('home')
  const [balance, setBalance] = useState<Balance | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [cacheInfo, setCacheInfo] = useState<{ cache?: string | null; stale?: string | null }>({})
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const loadHome = async (selected: Account) => {
    setLoading(true); setError('')
    try {
      const [balanceResponse, txResponse] = await Promise.all([api(`/accounts/${selected.id}/balance`), api(`/accounts/${selected.id}/transactions?limit=20`)])
      setBalance(balanceResponse.body); setCacheInfo({ cache: balanceResponse.cache, stale: balanceResponse.stale })
      setTransactions(txResponse.body.transactions || txResponse.body.data || txResponse.body || [])
      setCursor(txResponse.body.next_cursor || txResponse.body.nextCursor || null)
    } catch (e) { setError((e as ApiError).message || 'No pudimos cargar tu cuenta.') } finally { setLoading(false) }
  }
  const chooseAccount = (selected: Account) => { setAccount(selected); setScreen('home'); setTransactions([]); void loadHome(selected) }
  useEffect(() => { if (account) void loadHome(account) }, [])

  if (!account) return <Login onSelect={chooseAccount} />
  return <AppShell account={account} screen={screen} setScreen={setScreen} onLogout={() => { setAccount(null); setBalance(null) }}>
    {error && <div className="alert error"><X size={18} />{error}<button onClick={() => setError('')} aria-label="Cerrar error"><X size={16} /></button></div>}
    {screen === 'home' && <HomeScreen account={account} balance={balance} transactions={transactions.slice(0, 4)} cacheInfo={cacheInfo} loading={loading} onSend={() => setScreen('send')} onHistory={() => setScreen('history')} />}
    {screen === 'send' && <SendScreen account={account} onBack={() => setScreen('home')} onSuccess={() => { setScreen('home'); void loadHome(account) }} />}
    {screen === 'history' && <HistoryScreen transactions={transactions} cursor={cursor} loading={loadingMore} onBack={() => setScreen('home')} onLoadMore={async () => { if (!cursor || loadingMore) return; setLoadingMore(true); try { const r = await api(`/accounts/${account.id}/transactions?limit=20&cursor=${encodeURIComponent(cursor)}`); setTransactions(prev => [...prev, ...(r.body.transactions || r.body.data || [])]); setCursor(r.body.next_cursor || r.body.nextCursor || null) } catch (e) { setError((e as ApiError).message) } finally { setLoadingMore(false) } }} />}
  </AppShell>
}

function Login({ onSelect }: { onSelect: (a: Account) => void }) { return <main className="login-page"><div className="login-card"><div className="brand"><span className="brand-mark">M</span><span>mercadopago</span></div><div className="login-hero"><div className="wallet-icon"><Wallet size={36} /></div><h1>Tu plata, simple.</h1><p>Elegí una cuenta demo para entrar a tu billetera.</p></div><div className="account-list">{accounts.map(a => <button className="account-option" key={a.id} onClick={() => onSelect(a)}><span className="avatar" style={{ background: a.color }}>{a.initials}</span><span><strong>{a.name}</strong><small>{a.alias}</small></span><ChevronRight size={19} /></button>)}</div><p className="fine-print">Entorno demo · Tus datos están protegidos</p></div></main> }

function AppShell({ account, screen, setScreen, onLogout, children }: { account: Account; screen: string; setScreen: (s: 'home' | 'send' | 'history') => void; onLogout: () => void; children: React.ReactNode }) { return <div className="app"><header className="topbar"><div className="brand"><span className="brand-mark">M</span><span>mercadopago</span></div><button className="profile-button" onClick={onLogout}><span className="avatar mini" style={{ background: account.color }}>{account.initials}</span><span className="profile-name">{account.alias}</span><LogOut size={16} /></button></header><main className="content">{children}</main><nav className="bottom-nav"><button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}><Home size={21} /><span>Inicio</span></button><button className={screen === 'send' ? 'active' : ''} onClick={() => setScreen('send')}><Send size={21} /><span>Enviar</span></button><button className={screen === 'history' ? 'active' : ''} onClick={() => setScreen('history')}><Clock3 size={21} /><span>Actividad</span></button></nav></div> }

function HomeScreen({ account, balance, transactions, cacheInfo, loading, onSend, onHistory }: { account: Account; balance: Balance | null; transactions: Transaction[]; cacheInfo: { cache?: string | null; stale?: string | null }; loading: boolean; onSend: () => void; onHistory: () => void }) { return <section className="screen"><div className="greeting"><div><p className="eyebrow">Hola, {account.name}</p><h1>¿Qué querés hacer?</h1></div><button className="icon-button" aria-label="Menú"><Menu size={20} /></button></div><div className="balance-card"><div className="balance-top"><span>Dinero disponible</span><span className="currency-pill">{balance?.currency || 'ARS'}</span></div><strong>{loading ? 'Cargando…' : balance ? formatMoney(balance.balance, balance.currency) : '$ —'}</strong><div className="balance-meta">Actualizado {balance ? formatDate(balance.as_of) : 'ahora'} {cacheInfo.cache && <span className="cache-badge">{cacheInfo.stale === 'true' ? 'Stale' : cacheInfo.cache}</span>}</div></div><div className="quick-actions"><button onClick={onSend}><span className="action-icon purple"><ArrowUpRight size={22} /></span><span>Enviar dinero</span></button><button><span className="action-icon blue"><Plus size={22} /></span><span>Agregar dinero</span></button></div><div className="section-heading"><h2>Últimos movimientos</h2><button onClick={onHistory}>Ver todos <ChevronRight size={16} /></button></div><TransactionList transactions={transactions} loading={loading} /></section> }

function TransactionList({ transactions, loading }: { transactions: Transaction[]; loading: boolean }) { if (loading) return <div className="empty-state">Cargando movimientos…</div>; if (!transactions.length) return <div className="empty-state">Todavía no tenés movimientos.</div>; return <div className="transactions">{transactions.map((t, i) => { const income = isIncome(t); return <div className="transaction" key={t.id || t.transaction_id || i}><span className={`transaction-icon ${income ? 'income' : 'outcome'}`}>{income ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><span className="transaction-info"><strong>{transactionLabel(t)}</strong><small>{formatDate(t.created_at || t.occurred_at)}</small></span><strong className={income ? 'amount income-text' : 'amount'}>{income ? '+' : '-'}{formatMoney(Math.abs(Number(t.amount)), t.currency || 'ARS')}</strong></div> })}</div> }

function SendScreen({ account, onBack, onSuccess }: { account: Account; onBack: () => void; onSuccess: () => void }) { const [alias, setAlias] = useState(''); const [amount, setAmount] = useState(''); const [memo, setMemo] = useState(''); const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle'); const [error, setError] = useState(''); const idempotencyKey = useRef<string | null>(null); const valid = alias.trim().length > 0 && Number(amount) > 0; const send = async () => { if (!valid || status === 'sending') return; if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID(); setStatus('sending'); setError(''); try { await api('/transfers', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey.current }, body: JSON.stringify({ source_account_id: account.id, dest_alias: alias.trim(), amount: Number(amount).toFixed(2), currency: 'ARS', ...(memo.trim() ? { memo: memo.trim() } : {}) }) }); setStatus('success') } catch (e) { const err = e as ApiError; const messages: Record<number, string> = { 400: 'No tenés fondos suficientes para realizar esta transferencia.', 404: 'No encontramos ese alias. Revisalo e intentá de nuevo.', 409: 'Esta transferencia tiene un conflicto. Reintentá en unos segundos.', 429: 'Hiciste muchas operaciones. Esperá un momento y reintentá.' }; setError(messages[err.status] || err.message); setStatus('idle') } }; if (status === 'success') return <section className="screen centered-screen"><div className="success-check"><Check size={34} /></div><h1>¡Transferencia enviada!</h1><p>Le enviaste <strong>{formatMoney(amount, 'ARS')}</strong> a <strong>{alias}</strong>.</p><button className="primary-button" onClick={onSuccess}>Volver al inicio</button></section>; return <section className="screen"><button className="back-button" onClick={onBack}><ArrowLeft size={18} />Enviar dinero</button><h1 className="page-title">¿A quién le enviás?</h1><p className="page-subtitle">Transferí al instante usando un alias.</p>{error && <div className="alert error"><X size={18} />{error}</div>}<div className="form-card"><label>Alias <input value={alias} onChange={e => setAlias(e.target.value)} placeholder="ej. juan.mp" autoComplete="off" /></label><label>Monto <div className="money-input"><span>$</span><input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0,00" inputMode="decimal" /></div></label><label>Mensaje <span className="optional">Opcional</span><input value={memo} onChange={e => setMemo(e.target.value)} placeholder="¿Por qué le enviás?" maxLength={80} /></label></div><button className="primary-button send-button" disabled={!valid || status === 'sending'} onClick={send}>{status === 'sending' ? 'Enviando…' : 'Continuar'}<ChevronRight size={19} /></button></section> }

function HistoryScreen({ transactions, cursor, loading, onBack, onLoadMore }: { transactions: Transaction[]; cursor: string | null; loading: boolean; onBack: () => void; onLoadMore: () => void }) { return <section className="screen"><button className="back-button" onClick={onBack}><ArrowLeft size={18} />Actividad</button><div className="history-heading"><div><h1 className="page-title">Todos tus movimientos</h1><p className="page-subtitle">Transferencias y operaciones recientes</p></div><Copy size={18} className="muted-icon" /></div><TransactionList transactions={transactions} loading={false} />{cursor && <button className="load-more" onClick={onLoadMore} disabled={loading}>{loading ? 'Cargando…' : 'Cargar más movimientos'}</button>}</section> }

export { formatMoney }
