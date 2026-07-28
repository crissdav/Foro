import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

const avatars = ['🐶', '🐱', '🐼', '🦊', '🐸', '🐨', '🦁', '🐯', '🐰', '🐻', '🐵', '🐮', '🦄', '🐧', '🐝', '🐴']
const reacts = ['❤️', '🔥', '😂', '😮', '👍', '🐶', '🐱', '🐼', '🦊']

function getAvatar(name) {
  let h = 0
  for (const c of name) h = (h + c.charCodeAt(0)) % avatars.length
  return avatars[h]
}

function timeAgo(date) {
  const d = Date.now() - new Date(date).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'justo ahora'
  if (m < 60) return `hace ${m} min`
  const hr = Math.floor(m / 60)
  if (hr < 24) return `hace ${hr} h`
  const dy = Math.floor(hr / 24)
  if (dy < 7) return `hace ${dy} d`
  return new Date(date).toLocaleDateString('es-MX')
}

function totalReacts(r) {
  return Object.values(r || {}).reduce((s, v) => s + v, 0)
}

function App() {
  const [posts, setPosts] = useState([])
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [myReacts, setMyReacts] = useState(() => JSON.parse(localStorage.getItem('reacts') || '{}'))
  const fileRef = useRef(null)
  const blocking = useRef({})

  useEffect(() => { localStorage.setItem('reacts', JSON.stringify(myReacts)) }, [myReacts])

  const fetchPosts = useCallback(() => {
    fetch(`/api/posts?_=${Date.now()}`)
      .then(r => r.json())
      .then(d => { setPosts(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchPosts(); const id = setInterval(fetchPosts, 8000); return () => clearInterval(id) }, [fetchPosts])

  const react = async (postId, emoji) => {
    const key = `${postId}:${emoji}`
    if (blocking.current[key]) return
    blocking.current[key] = true

    const active = myReacts[key]
    const dir = active ? -1 : 1

    setMyReacts(p => ({ ...p, [key]: !active }))
    setPosts(p => p.map(post => {
      if (post._id !== postId) return post
      const r = { ...(post.reactions || {}) }
      r[emoji] = Math.max(0, (r[emoji] || 0) + dir)
      return { ...post, reactions: r }
    }))

    try {
      const res = await fetch(`/api/posts/${postId}/react`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, dir }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setPosts(p => p.map(post =>
        post._id === postId ? { ...post, reactions: updated.reactions } : post
      ))
    } catch {
      setMyReacts(p => ({ ...p, [key]: active }))
      setPosts(p => p.map(post => {
        if (post._id !== postId) return post
        const r = { ...(post.reactions || {}) }
        r[emoji] = Math.max(0, (r[emoji] || 0) - dir)
        return { ...post, reactions: r }
      }))
    } finally {
      blocking.current[key] = false
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!message.trim() || sending) return
    setSending(true); setError(null)
    const fd = new FormData()
    fd.append('username', username.trim() || 'Anónimo')
    fd.append('message', message)
    if (image) fd.append('image', image)
    const r = await fetch('/api/posts', { method: 'POST', body: fd }).catch(() => null)
    if (r && r.ok) {
      const p = await r.json()
      setPosts(prev => [p, ...prev])
      setMessage(''); setImage(null); setPreview(null); setShowForm(false)
      if (fileRef.current) fileRef.current.value = ''
    } else {
      setError('Error al publicar')
    }
    setSending(false)
  }

  const pickImage = () => {
    const f = fileRef.current?.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { setError('Máximo 5MB'); return }
    if (!/^image\/(jpeg|png|gif|webp)$/.test(f.type)) { setError('Solo JPG, PNG, GIF, WebP'); return }
    setImage(f); setPreview(URL.createObjectURL(f)); setError(null)
  }

  return (
    <div className="App">
      <nav className="navbar">
        <div className="nav-inner">
          <div className="nav-brand">
            <span className="brand-icon">🐾</span>
            <span className="brand-text">AnimalForo</span>
          </div>
          <span className="nav-sub">r/animales</span>
          <div className="nav-spacer" />
          <button className="nav-create-btn" onClick={() => { setError(null); setShowForm(true) }}>
            <span className="nav-create-icon">+</span>
            <span className="nav-create-text">Crear</span>
          </button>
        </div>
      </nav>

      <main className="main">
        <div className={`overlay ${showForm ? 'open' : ''}`} onClick={() => setShowForm(false)} />

        <div className={`drawer ${showForm ? 'open' : ''}`}>
          <div className="drawer-head">
            <span className="drawer-av">{getAvatar(username || '?')}</span>
            <span className="drawer-title">Crear publicación</span>
            <button className="drawer-x" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <form onSubmit={submit}>
            <div className="drawer-body">
              <input className="d-input" placeholder="Tu nombre (opcional)" value={username} onChange={e => setUsername(e.target.value)} maxLength={50} />
              <textarea className="d-area" placeholder="¿Qué quieres compartir sobre animales?" value={message} onChange={e => setMessage(e.target.value)} maxLength={500} required />
              <div className="d-attach" onClick={() => fileRef.current?.click()}>
                <span className="d-attach-icon">📷</span>
                <span className="d-attach-text">{image ? image.name : 'Agregar imagen'}</span>
                {preview && <img className="d-preview" src={preview} alt="" />}
              </div>
               <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={pickImage} hidden style={{ pointerEvents: 'none' }} />
              {image && <span className="d-remove" onClick={() => { setImage(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}>✕ Quitar</span>}
              {error && <div className="d-error">{error}</div>}
            </div>
            <div className="drawer-foot">
              <span className="d-chars">{message.length}/500</span>
              <button className="d-btn" disabled={sending || !message.trim()}>
                {sending ? <span className="spinner" /> : 'Publicar'}
              </button>
            </div>
          </form>
        </div>

        {loading ? (
          <div className="loading"><div className="load-spin" /><p>Cargando...</p></div>
        ) : !posts.length ? (
          <div className="empty">
            <span className="empty-icon">🐾</span>
            <h3>No hay publicaciones</h3>
            <p>Sé el primero en compartir algo</p>
            <button className="empty-btn" onClick={() => setShowForm(true)}>Crear</button>
          </div>
        ) : (
          [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(p => {
            const total = totalReacts(p.reactions)
            return (
              <article key={p._id} className="card">
                <div className="card-head">
                  <span className="card-av">{getAvatar(p.username)}</span>
                  <span className="card-user">u/{p.username}</span>
                  <span className="card-dot">•</span>
                  <span className="card-time">{timeAgo(p.createdAt)}</span>
                </div>
                <p className="card-text">{p.message}</p>
                {p.image && <img className="card-img" src={p.image} alt="" loading="lazy" />}
                <div className="react-bar">
                  {reacts.map(e => {
                    const count = (p.reactions || {})[e] || 0
                    const active = myReacts[`${p._id}:${e}`]
                    return (
                      <button key={e} className={`react-btn${active ? ' on' : ''}${count === 0 ? ' zero' : ''}`} onClick={() => react(p._id, e)}>
                        {e} {count > 0 && <span className="rc">{count}</span>}
                      </button>
                    )
                  })}
                  {total > 0 && <span className="react-total">{total} reacciones</span>}
                </div>
              </article>
            )
          })
        )}
      </main>
    </div>
  )
}

export default App
