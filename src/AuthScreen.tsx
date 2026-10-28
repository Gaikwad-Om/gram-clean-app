import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Leaf, LoaderCircle, LockKeyhole, Mail, MapPin, UserRound } from 'lucide-react'
import { supabase } from './lib/supabase'

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase || busy) return
    setError('')
    setMessage('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim(), preferred_language: 'mr' } } })
        if (authError) throw authError
        if (!data.session) setMessage('Check your email to confirm your account, then come back here to sign in.')
        else setMessage('Account created. Now enter your village code to join your community.')
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not complete sign-in. Try again.')
    } finally { setBusy(false) }
  }
  return <main className="auth-page"><section className="auth-side"><div className="auth-brand"><span className="brand-mark"><Leaf size={22} /></span><span><b>gram clean</b><small>Village care, together</small></span></div><div className="auth-story"><span className="auth-kicker"><MapPin size={14} /> MADE FOR YOUR VILLAGE</span><h1>Good things grow when we work together.</h1><p>Report what needs fixing. Follow the progress. Help keep your community clean, safe and cared for.</p><div className="auth-illustration"><VillageIllustration /></div><div className="auth-quote"><span>“</span><p>Every neighbour has a part to play in making our village a better place.</p></div></div><small className="auth-foot">SONAPUR VILLAGE · RATNAGIRI, MAHARASHTRA</small></section><section className="auth-form-side"><div className="auth-form-wrap"><div className="auth-form-heading"><span className="mobile-brand-mark"><Leaf size={20} /></span><p className="eyebrow">YOUR COMMUNITY, CLOSER TOGETHER</p><h2>{mode === 'signin' ? 'Welcome back' : 'Join Gram Clean'}</h2><p>{mode === 'signin' ? 'Sign in to follow your village reports and updates.' : 'Create your account to start helping your village.'}</p></div><form onSubmit={submit}>{mode === 'signup' && <label className="auth-field"><span>Your name</span><span className="auth-input"><UserRound size={16} /><input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Anita Patil" /></span></label>}<label className="auth-field"><span>Email address</span><span className="auth-input"><Mail size={16} /><input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></span></label><label className="auth-field"><span>Password</span><span className="auth-input"><LockKeyhole size={16} /><input required type="password" minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /></span></label>{error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-message" role="status"><CheckCircle2 size={16} />{message}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : null}{mode === 'signin' ? 'Sign in' : 'Create account'}{!busy && <ArrowRight size={16} />}</button></form><p className="auth-switch">{mode === 'signin' ? 'New to Gram Clean?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p><div className="auth-secure"><LockKeyhole size={13} /> Your village account is protected with Supabase authentication.</div></div></section></main>
}

function VillageIllustration() {
  return <div className="auth-village-art"><div className="art-sun"/><div className="hill hill-back"/><div className="hill hill-front"/><div className="art-house house-one"><i/><b/><span/></div><div className="art-house house-two"><i/><b/><span/></div><div className="art-house house-three"><i/><b/><span/></div><div className="art-tree tree-one"><i/><b/></div><div className="art-tree tree-two"><i/><b/></div><div className="art-tree tree-three"><i/><b/></div><div className="art-path"/></div>
}

export function JoinVillageScreen({ displayName, onJoin, onSignOut }: { displayName: string; onJoin: (slug: string) => Promise<void>; onSignOut: () => void }) {
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try { await onJoin(slug.trim().toLowerCase()) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not join that village. Check the village code and try again.') }
    finally { setBusy(false) }
  }
  return <main className="join-page"><section className="join-card"><div className="brand-mark"><Leaf size={22}/></div><p className="eyebrow">WELCOME TO GRAM CLEAN</p><h1>Hello, {displayName}</h1><p className="join-intro">Enter the village code shared by your local administrator to join your community workspace.</p><form onSubmit={submit}><label className="auth-field"><span>Village code</span><span className="auth-input"><MapPin size={16}/><input autoFocus required pattern="[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*" value={slug} onChange={event => setSlug(event.target.value)} placeholder="e.g. sonapur" /></span></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : null}Join village <ArrowRight size={16}/></button></form><button className="sign-out-link" onClick={onSignOut}>Sign out and use another account</button></section></main>
}
