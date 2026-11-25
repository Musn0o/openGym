import { Capacitor, registerPlugin } from '@capacitor/core'
import { getMusic, setMusic } from './music-store.js'
import { playlistTracks, setActivePlaylist, setPlaybackIndex, setLastPlaylist } from './music.js'

const Music = registerPlugin('MusicPlayer')
const isNative = () => Capacitor.isNativePlatform()

export async function pickMusicTracks() {
  if (!isNative()) return []
  const res = await Music.pick()
  return Array.isArray(res?.tracks) ? res.tracks : []
}

export async function scanDeviceMusic() {
  if (!isNative()) return []
  try {
    const res = await Music.scan()
    return Array.isArray(res?.tracks) ? res.tracks : []
  } catch { return [] }
}

export async function removeMusicFile(src) {
  if (!isNative() || !src) return
  try { await Music.remove({ src }) } catch {}
}

export async function playMusicPlaylist(playlistId, index = null) {
  if (!isNative()) return
  let m = getMusic()
  const p = m.playlists.find(x => x.id === playlistId)
  if (!p) return
  const tracks = playlistTracks(m, playlistId).map(t => ({ name: t.name, ...(t.src ? { src: t.src } : {}), ...(t.uri ? { uri: t.uri } : {}) }))
  if (!tracks.length) return
  let at = index
  if (!Number.isInteger(at)) {
    const st = await musicState()
    at = st.playlistId === playlistId && Number.isInteger(st.index) ? st.index : (m.progress[playlistId] ?? 0)
  }
  at = Math.max(0, Math.min(at, tracks.length - 1))
  setMusic(s => setPlaybackIndex(setActivePlaylist(setLastPlaylist(s, playlistId), playlistId), playlistId, at))
  m = getMusic()
  await Music.play({ playlistId, tracks, index: at, title: p.name })
}

export async function pauseMusic() { if (isNative()) try { await Music.pause() } catch {} }
export async function resumeMusic() { if (isNative()) try { await Music.resume() } catch {} }
export async function stopMusic() { if (isNative()) try { await Music.stop() } catch {} }
export async function nextMusic() { if (isNative()) try { await Music.next() } catch {} }
export async function prevMusic() { if (isNative()) try { await Music.prev() } catch {} }
export async function musicState() {
  if (!isNative()) return { playing: false, index: 0, title: '', playlist: '', playlistId: null }
  try { return await Music.state() } catch { return { playing: false, index: 0, title: '', playlist: '', playlistId: null } }
}

export async function musicPermission() {
  if (!isNative()) return 'granted'
  try { return (await Music.permission?.())?.state || 'unknown' } catch { return 'unknown' }
}
