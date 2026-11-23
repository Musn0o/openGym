// Local music player (Android-first, v1.4.5). Playlists and tracks live on this device only:
// S.music = { playlists: [{ id, name, tracks: [{ id, name, src, dur }] }], last: playlistId }
// `src` is a filename in Library/opengym-music/. Tracks are copied in on import; no server sync,
// no backup export of audio bytes (metadata only is harmless but we keep it local by default).
// Playback is native on Android (foreground service) so it keeps playing with screen off.

import { uid } from './format.js'

export const MUSIC_DIR = 'opengym-music'

export const musicOf = S => {
  const m = Array.isArray(S?.playlists) ? S : S?.music
  const playlists = Array.isArray(m?.playlists) ? m.playlists.map(normalizePlaylist).filter(Boolean) : []
  const last = typeof m?.last === 'string' && playlists.some(p => p.id === m.last) ? m.last : null
  const active = typeof m?.active === 'string' && playlists.some(p => p.id === m.active) ? m.active : last
  return { playlists, last, active }
}

function normalizePlaylist(p) {
  if (!p || typeof p !== 'object' || typeof p.id !== 'string') return null
  const tracks = Array.isArray(p.tracks) ? p.tracks.map(normalizeTrack).filter(Boolean) : []
  return { id: p.id, name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 80) : 'Playlist', tracks }
}

function normalizeTrack(t) {
  if (!t || typeof t !== 'object' || typeof t.id !== 'string') return null
  const src = typeof t.src === 'string' ? t.src : null
  const uri = typeof t.uri === 'string' ? t.uri : null
  if (!src && !uri) return null
  return {
    id: t.id,
    name: typeof t.name === 'string' && t.name.trim() ? t.name.trim().slice(0, 120) : 'Track',
    ...(src ? { src } : {}),
    ...(uri ? { uri } : {}),
    ...(Number.isFinite(t.dur) && t.dur > 0 ? { dur: Math.round(t.dur) } : {}),
  }
}

export function createPlaylist(S, name) {
  const m = musicOf(S)
  const p = { id: uid(), name: (name || 'Playlist').trim().slice(0, 80) || 'Playlist', tracks: [] }
  return { ...m, playlists: [...m.playlists, p] }
}

export function renamePlaylist(S, id, name) {
  const m = musicOf(S)
  return { ...m, playlists: m.playlists.map(p => p.id === id ? { ...p, name: (name || p.name).trim().slice(0, 80) || p.name } : p) }
}

export function removePlaylist(S, id) {
  const m = musicOf(S)
  const playlists = m.playlists.filter(p => p.id !== id)
  return { playlists, last: m.last === id ? null : m.last }
}

export function addTracks(S, playlistId, tracks) {
  const m = musicOf(S)
  const clean = (Array.isArray(tracks) ? tracks : []).map(normalizeTrack).filter(Boolean)
  return { ...m, playlists: m.playlists.map(p => p.id === playlistId ? { ...p, tracks: [...p.tracks, ...clean] } : p) }
}

export function removeTrack(S, playlistId, trackId) {
  const m = musicOf(S)
  return { ...m, playlists: m.playlists.map(p => p.id === playlistId ? { ...p, tracks: p.tracks.filter(t => t.id !== trackId) } : p) }
}

export function moveTrack(S, playlistId, from, to) {
  const m = musicOf(S)
  return {
    ...m,
    playlists: m.playlists.map(p => {
      if (p.id !== playlistId) return p
      const tracks = p.tracks.slice()
      if (from < 0 || from >= tracks.length || to < 0 || to >= tracks.length) return p
      const [it] = tracks.splice(from, 1)
      tracks.splice(to, 0, it)
      return { ...p, tracks }
    }),
  }
}

export function setLastPlaylist(S, id) {
  const m = musicOf(S)
  return { ...m, last: id && m.playlists.some(p => p.id === id) ? id : null }
}

export function setActivePlaylist(S, id) {
  const m = musicOf(S)
  return { ...m, active: id && m.playlists.some(p => p.id === id) ? id : null }
}
