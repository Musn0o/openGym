import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { Button, Row, Section } from './ui.jsx'
import Icon from './Icon.jsx'
import { useMusic, setMusic, getMusic } from '../lib/music-store.js'
import { createPlaylist, setPlaybackIndex } from '../lib/music.js'
import { scanDeviceMusic, pauseMusic, resumeMusic, nextMusic, prevMusic, musicState } from '../lib/music-player.js'
import { useUI } from '../store/useUI.js'
import { uid } from '../lib/format.js'
import { addTracks } from '../lib/music.js'

export function promptSheet({ title, label, value = '', placeholder = '', confirmText = t('Save'), onConfirm }) {
  useUI.getState().openSheet(close => {
    function Body() {
      const [v, setV] = useState(value)
      return <div style={{ display: 'grid', gap: 12 }}>
        <h3>{title}</h3>
        {label && <div className="ss">{label}</div>}
        <input className="field" value={v} placeholder={placeholder} onChange={e => setV(e.target.value)} />
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="plain" onClick={close}>{t('Cancel')}</Button>
          <Button variant="primary" onClick={() => { close(); onConfirm(v) }}>{confirmText}</Button>
        </div>
      </div>
    }
    return <Body />
  })
}

export function MiniPlayer() {
  const [st, setSt] = useState({ playing: false, title: '', playlist: '', index: 0, playlistId: null })
  const last = useRef('')
  useEffect(() => {
    let on = true
    const poll = async () => {
      const s = await musicState()
      if (!on) return
      setSt(s)
      if (s.playlistId && Number.isInteger(s.index)) {
        const key = `${s.playlistId}:${s.index}`
        if (key !== last.current) { last.current = key; setMusic(m => setPlaybackIndex(m, s.playlistId, s.index)) }
      }
    }
    poll()
    const id = setInterval(poll, 1500)
    return () => { on = false; clearInterval(id) }
  }, [])
  if (!st.title && !st.playing) return null
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--card)', margin: '0 0 12px' }}>
    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, var(--acc) 18%, transparent)', display: 'grid', placeItems: 'center', color: 'var(--acc)' }}><Icon name="music" /></div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="tt" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.title || t('Music')}</div>
      <div className="ss" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.playlist || ''}</div>
    </div>
    <button className="icon-btn" aria-label={t('Previous')} onClick={() => prevMusic()}><Icon name="chevronLeft" /></button>
    <button className="icon-btn" aria-label={st.playing ? t('Pause') : t('Play')} onClick={() => st.playing ? pauseMusic() : resumeMusic()}><Icon name={st.playing ? 'pause' : 'play'} /></button>
    <button className="icon-btn" aria-label={t('Next')} onClick={() => nextMusic()}><Icon name="chevronRight" /></button>
  </div>
}

export function SongPicker({ playlist, onClose }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [library, setLibrary] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const existing = useMemo(() => new Set((playlist.tracks || []).map(t => t.uri || t.src)), [playlist.tracks])

  const scan = async () => {
    setBusy(true)
    try { setLibrary(await scanDeviceMusic()) } finally { setBusy(false) }
  }
  useEffect(() => { scan() }, [])

  const filtered = library.filter(t => !q.trim() || t.name.toLowerCase().includes(q.toLowerCase()))
  const toggle = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const addSelected = () => {
    const tracks = library.filter(t => selected.has(t.id) && !existing.has(t.uri || t.src)).map(x => ({ id: uid(), name: x.name, src: x.src, uri: x.uri, dur: x.dur, at: Date.now() }))
    if (tracks.length) setMusic(m => addTracks(m, playlist.id, tracks))
    onClose()
  }

  return <div style={{ display: 'grid', gap: 12 }}>
    <div className="row between" style={{ gap: 8 }}>
      <h3 style={{ margin: 0 }}>{t('Add device music')}</h3>
      <Button size="sm" variant="plain" onClick={scan} disabled={busy}>{busy ? t('Scanning...') : t('Rescan')}</Button>
    </div>
    <input className="field" value={q} placeholder={t('Search songs')} onChange={e => setQ(e.target.value)} />
    <div style={{ maxHeight: '50vh', overflow: 'auto', display: 'grid', gap: 6 }}>
      {filtered.map(track => {
        const inPl = existing.has(track.uri || track.src)
        const sel = selected.has(track.id)
        return <button key={track.id} className="item" style={{ textAlign: 'left', opacity: inPl ? 0.55 : 1 }} onClick={() => !inPl && toggle(track.id)}>
          <span className="lrow-i" style={{ color: sel || inPl ? 'var(--acc)' : undefined }}><Icon name={inPl ? 'check' : sel ? 'check' : 'music'} /></span>
          <div className="grow"><div className="tt">{track.name}</div><div className="ss">{inPl ? t('Already in playlist') : track.dur ? `${Math.floor(track.dur/60)}:${String(track.dur%60).padStart(2,'0')}` : t('Song')}</div></div>
        </button>
      })}
      {!busy && filtered.length === 0 && <div className="small dim" style={{ padding: 12 }}>{t('No songs found. Check audio permission or add music to your phone.')}</div>}
    </div>
    <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
      <Button variant="plain" onClick={onClose}>{t('Cancel')}</Button>
      <Button variant="primary" disabled={selected.size === 0} onClick={addSelected}>{t('Add {0} songs', selected.size)}</Button>
    </div>
  </div>
}

export default function MusicSettingsPage() {
  const music = useMusic()
  const nav = useNavigate()

  const addPlaylist = () => promptSheet({
    title: t('New playlist'), label: t('Name'), placeholder: t('Workout music'), confirmText: t('Create'),
    onConfirm: name => {
      const next = createPlaylist(music, name || t('Playlist'))
      setMusic(next)
      nav('/music/' + next.playlists.at(-1).id)
    },
  })

  const active = music.active || music.last
  return <>
    <MiniPlayer />
    <Section title={t('Playlists')} footer={t('Scan device music, build workout playlists, and pick one when a workout starts. Music plays with the screen off.')}>
      {music.playlists.length === 0 && <Row icon="music" iconTint="var(--pink)" title={t('No playlists yet')} subtitle={t('Create a playlist, then add songs from your device.')} />}
      {music.playlists.map(p => (
        <Row key={p.id} icon={p.id === active ? 'check' : 'music'} iconTint={p.id === active ? 'var(--acc)' : 'var(--pink)'} title={p.name}
          subtitle={`${t('{0} songs', p.tracks.length)}${p.id === active ? ` · ${t('Selected for workout')}` : ''}`} accessory="chevron"
          onClick={() => nav('/music/' + p.id)} />
      ))}
      <div className="row" style={{ gap: 8, padding: '8px 16px 12px' }}>
        <Button size="sm" variant="tinted" icon="plus" onClick={addPlaylist}>{t('New playlist')}</Button>
      </div>
    </Section>
  </>
}
